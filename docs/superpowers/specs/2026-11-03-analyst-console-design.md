# Analyst Console Design

## Intent

Issue #30 completes issue #8 with the analyst side of human support. An analyst
sees the conversations that need a person, reads the conversation history and the
employee's ticket context, atomically claims a conversation (pausing the agent),
replies, returns it to the agent, or closes it. This builds on the durable
conversation lifecycle introduced by #29 (`agent` / `waiting_for_analyst`,
`stateVersion`, handoff metadata).

The employee side is already in place: an employee hands off and sees a waiting
state. This increment makes the other half work — a human can actually take over
and answer — while keeping the agent silent and rejecting stale agent output.

## Goals

- Add the analyst queue: list/filter conversations that are waiting or owned,
  with enough preview to triage (employee name, handoff reason/summary, state,
  associated ticket).
- Add atomic claim, reply, return-to-agent, and close operations, guarded by the
  existing state/version mechanism so concurrent claims and stale agent output
  stay safe.
- Expose the employee's ticket context (the conversation's ticket plus their
  other tickets) to the analyst, as the design's "Chamados da Ana" panel shows.
- Show analyst replies to the employee as ordinary messages in their chat
  thread, with the analyst's name and a support tag.
- Keep the agent silent while a conversation is `waiting_for_analyst` or
  `with_analyst`, and make human support work even when the model quota is
  exhausted.

## Non-goals

- Prototype fidelity for the analyst frames (V04/V05). The console is functional
  first; visual polish stays in issue #9.
- N1/N2 role hierarchy. The fixtures have one analyst role; the design's
  "Suporte N2" tag is illustrative and is rendered as a generic support label.
- A response-time promise. The design's "até 2 h úteis" is illustrative copy and
  is not rendered as a committed SLA.
- Real-time push of analyst replies to an open employee chat. See Approaches.
- Modifying ticket state from the console. The "Chamados da Ana" panel is
  read-only context for this increment; the ticket status changes the design
  illustrates ("Aguardando analista" -> "Em atendimento") are not implemented
  here.

## Anti-goals

- Do not let an unassigned analyst reply as the owner.
- Do not let the agent produce an answer after a claim/return changes state.
- Do not expose employee ticket data beyond what an analyst needs to service the
  conversation.
- Do not lose the existing employee handoff, draft confirmation, session cap, or
  privacy behavior.

## Constraints

- Authenticated identity comes only from the server session (`IdentityGuard`);
  request bodies never carry an analyst ID.
- Conversation states are exactly `agent`, `waiting_for_analyst`,
  `with_analyst`, and `closed` (architecture). Claims, returns, and closes are
  conditional `updateMany` transitions that increment `stateVersion`.
- Only the assigned analyst may reply, return, or close; claim is the atomic
  transition that assigns.
- Analyst replies are plain persisted messages — no model call, so they keep
  working under model quota exhaustion (B15).
- Shared Zod contracts through `packages/contracts`; strict TypeScript; the
  simulated ticket service stays behind its existing typed interface.
- UI copy is Brazilian Portuguese; code, contracts, commits, and docs are
  English.

## Approaches

1. **Delivering analyst replies to the employee.** (a) Persist the message and
   let the employee see it on reload or the next send (no push infrastructure);
   (b) poll the employee chat for new messages while waiting; (c) push over a
   fan-out SSE channel. The design shows the reply as an ordinary thread message
   but does not mandate a delivery mechanism, so **we chose (a)** for this
   increment: simplest, consistent with the existing history-based model, and
   upgradeable later.
2. **Ownership model.** (a) A single nullable `assignedAnalystId` on
   `Conversation`; (b) a separate assignment table. One active analyst per
   conversation matches the design, so **we chose (a)**.
3. **Message authorship.** (a) A nullable `authorId` relation from `Message` to
   `User`, set only for analyst-authored messages; (b) an inline analyst-name
   string. **We chose (a)** so the sender name and role stay denormalized-safe
   and auditable.
4. **Where the analyst API lives.** A new `human-support` backend module (per the
   architecture's "human support" module) rather than overloading
   `conversations`. **We chose the new module**, with authorization in the
   service.

## Design

### Data model

- `Conversation` gains a nullable `assignedAnalystId` (relation to `User`) and a
  nullable `closedAt`. States `with_analyst` and `closed` become reachable.
- `Message` gains a nullable `authorId` (relation to `User`) and the role value
  `analyst`. `employee` and `agent` roles are unchanged.
- No new ticket fields: the analyst reads the existing `Ticket` rows the employee
  owns, for the conversation's ticket and the employee's other tickets.

### State transitions

- `agent` -> `waiting_for_analyst`: existing handoff (employee request or an
  authorized automatic trigger), already in #29.
- `waiting_for_analyst` -> `with_analyst`: **claim**. Atomic `updateMany` from the
  waiting state with the current `stateVersion`; sets `assignedAnalystId` and
  increments the version. A losing concurrent claim gets a conflict.
- `with_analyst` -> `agent`: **return**. Clears `assignedAnalystId`, increments
  the version. The agent resumes but does not generate on its own; it answers the
  next employee message.
- `with_analyst` -> `closed`: **close**. Sets `closedAt`, increments the version.
- The agent's terminal write already requires `state = 'agent'` and the captured
  version, so a claim or return that changes state/version naturally discards
  stale in-flight agent output (no new guard needed).

### API (new `human-support` module, analyst-authorized)

- `GET /api/support/conversations?filter=waiting|owned|all` — queue list with
  preview and the employee's primary ticket reference.
- `GET /api/support/conversations/:id` — full history, handoff context, and the
  employee's ticket list (conversation ticket + others).
- `POST /api/support/conversations/:id/claim` — atomic claim.
- `POST /api/support/conversations/:id/reply` — analyst message (assigned only).
- `POST /api/support/conversations/:id/return` — return to agent (assigned only).
- `POST /api/support/conversations/:id/close` — close (assigned only).

Analysts may list/read waiting and owned conversations and their associated
tickets (that is the queue's purpose). Writing operations require assignment;
claim is how assignment happens.

### Employee side

- The existing `GET /api/conversations/:id/messages` returns analyst messages
  with the author's name and role; the chat renders them as a human message with
  a support tag. The employee sees them on reload or the next send.
- The employee chat treats `waiting_for_analyst` and `with_analyst` the same way:
  a human is engaged, so it shows no agent output and no "Falar com analista"
  button, while the composer stays enabled and employee messages persist for the
  analyst. The current component only special-cases `waiting_for_analyst`, so it
  must be extended so a claim does not re-expose the handoff control.
- `closed` is terminal for the employee: the chat shows "atendimento encerrado"
  and offers a new conversation; it no longer sends messages or waits for an
  agent.

### Console UI (functional)

- A role-gated analyst view (separate route) with: a filterable conversation
  list ("Todas", "Para você", "Com o agent", "Minhas" as a functional mapping),
  the conversation thread with agent/analyst/system markers, a takeover bar
  ("Assumir atendimento" while waiting; "Devolver ao agent" and "Encerrar
  atendimento" while owned), a locked composer while unassigned, and the
  employee ticket panel.

## Open items for the builder

- Exact contract field names and the precise filter mapping to states are left
  to the plan and tests, constrained by the states and authorization above.
- The queue's "primary ticket reference" (the design's "Transferida · INC-20311")
  must be derived without fabricating data: prefer the conversation's committed
  draft/ticket reference, else omit a specific reference rather than guess. The
  plan must pin this down.
- System markers in the thread ("Transferida…", "Rafael Lima assumiu…") are
  derived from persisted conversation metadata rather than stored as messages;
  the plan decides the exact derivation.

## Acceptance evidence

- B11: analyst filters/selects, reads context, claims, replies, returns, closes;
  an unassigned analyst cannot reply; concurrent claims are atomic.
- B10/B13 (analyst portions): ownership and pause survive restart; stale
  in-flight agent output is still discarded after claim/return.
- B15: analyst reply works with the model unavailable (no model call).
- V04/V05: the console reproduces the functional layout and states above, with
  visual fidelity deferred to #9.
