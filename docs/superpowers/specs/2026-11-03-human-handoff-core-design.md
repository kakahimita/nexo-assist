# Human Handoff Core Design

## Intent

Deliver the first bounded increment of issue #8: an employee conversation can
be handed to human support safely and durably. The agent must stop producing
answers immediately, employee messages must remain available for a human, and
an in-flight model result must never appear after handoff. The analyst queue
and owned-conversation console are deliberately deferred to a linked follow-up
delivery, so this increment can establish and verify the trust boundary first.

## Goals

- Persist `agent` and `waiting_for_analyst` conversation states, a handoff
  reason, a readable summary, and a monotonic state version.
- Make employee-requested, critical, overdue, and unresolved-uncertainty
  handoffs create the same durable waiting state.
- Accept a post-handoff employee message without invoking the agent.
- Reject a late agent result if the conversation is no longer in `agent` state
  or its state version has changed.
- Expose the employee's current waiting state and handoff context through
  server-validated contracts and HTTP endpoints.
- Verify privacy, restart durability, trigger reasons, agent silence, and an
  in-flight handoff race using isolated integration databases.

## Non-goals

- Analyst list filters, atomic analyst claim, analyst reply, return to agent,
  and close operations. Those belong to the next linked console increment.
- Full prototype fidelity, responsive console polish, or visual acceptance V04
  and V05; those remain issue #9 after the console is functionally usable.
- Inventing an SLA promise. Handoff copy reports the persisted state without a
  prototype-derived response-time commitment.

## Constraints

- NestJS owns state transitions, authorization, persistence, and stale-output
  checks. The model neither receives nor selects authenticated identity.
- Contracts remain strict Zod schemas shared by API and web.
- Existing conversation and draft-confirmation behaviour stays compatible.
- Human-support state must survive a process restart and cannot be cleared by
  elapsed time or by creating a new conversation.
- Use the B09, B10, B13, B14, B15, and B16 acceptance rows; original PRD
  pages 1, 2, 4, and 5 define the behaviour and Screens 4–5 guide later UI.

## Approaches considered

1. **Only stop the streaming request in memory.** This is the smallest code
   change, but it loses the pause after a restart and cannot reliably prevent a
   concurrent final write. It fails B10 and B13.
2. **Persist a state flag, then check it before writing the final answer.** It
   meets the durable pause requirement, but a return-to-agent or a second
   handoff could create an ABA race unless the check also identifies the exact
   state observed when the run started.
3. **Persist a state plus monotonic version and condition every agent write on
   both.** This is the selected approach. A state transition increments the
   version atomically; the final agent write is an `updateMany`-guarded
   transaction that succeeds only for the original `agent` state/version.
   It makes stale output rejection explicit and testable while remaining
   independent of model-provider cancellation.

## Design

`Conversation` gains a state, state version, handoff metadata, and later an
optional analyst owner relation. This first increment writes only `agent` and
`waiting_for_analyst`. A handoff service validates employee ownership, derives
the summary from persisted conversation/ticket facts, records an auditable
system event, changes the state, and increments the version in one database
transaction. A future analyst claim will consume this same state/version rather
than introduce a separate queue representation.

The consultation endpoint captures the state version together with the
accepted employee message. It may stream partial text while the conversation is
still agent-owned, but it persists no agent message unless the final guarded
transaction finds exactly that conversation, in `agent` state, at the captured
version. A losing race is discarded silently from the employee transcript and
reported as a state-change SSE event. Failure handling follows the same guard:
it must not append a misleading failed agent answer after handoff.

The deterministic engine and live prompt obtain a single explicit
`request_handoff` decision/action contract. The server, not model prose,
validates eligible reasons and writes the transition. Existing critical draft
proposal and overdue-ticket results become server-verified triggers; employee
requests use an explicit endpoint/control. Unresolved low-confidence decisions
may request handoff only when their supporting decision data is persisted.

The employee view receives a small, accessible waiting panel: the reason and
summary, an explanation that a human will respond, and a composer that still
persists employee messages but displays no agent response. It is intentionally
functional rather than a recreation of the analyst frames.

## Acceptance evidence

- B09: independently exercise employee request, critical incident, overdue
  ticket, and unresolved uncertainty; assert one durable summary and reason.
- B10/B13: begin a controllable consultation, hand off before it finishes,
  then assert no agent message appears; restart on the same SQLite database and
  assert the waiting state remains.
- B14/B15: messages while waiting still count toward the existing cap and can
  be persisted when the model is unavailable; no model call is made.
- B16: another employee cannot inspect or request a handoff for the
  conversation; client-supplied identity, reason metadata, and summary fields
  are rejected or ignored.

## Open implementation choices

- The next delivery must be created as a linked GitHub issue before its branch
  is created. It will add atomic analyst claims, owned replies, return, close,
  the queue API, and the minimum usable analyst console atop this state model.
- The precise wording of the generated summary will be implemented as a
  deterministic server formatter so the queue never depends on untrusted model
  text. Its fields will be fixed in the implementation plan and tests.
