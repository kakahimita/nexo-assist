# Ticket number and conversation-aware status design

**Issue:** [#49](https://github.com/kakahimita/nexo-assist/issues/49), child of
[#9](https://github.com/kakahimita/nexo-assist/issues/9); the current branch
`feature/LAB-0046` carries the visual follow-ups #46/#48, and this is a separate behavioral
increment delivered on that branch. **Refs:** #9, #46, #48.

**Sources:** PRD v5 Annex B ticket examples (`INC-20311`, `REQ-10442`, `INC-20150`) and
p5 Screen 3; Pencil frames `vbsNW` (V03 consultation), `IcuoM` (V02 draft), `x2HBOE` and
`CAqx8` (V04/V05 console). The frame `vbsNW` is the visual authority for the card, the
selection rows and the status vocabulary. The PRD is the behavior authority and treats
its sample statuses as illustrative; the conventions below are this project's explicit
choices and must be disclosed as such.

## Intent

Make a consultation answer read as a real service-desk record instead of prose: the
employee sees the ticket number, a truthful status, the description and the timing of the
ticket, and the agent's reply is a short sentence plus controls. Today the card has no
number or description, the status vocabulary is only `aberto`/`resolvido`, and no
application action ever closes a ticket (only seed data creates resolved tickets).

## Goals

- Give every ticket a stable human-facing number: `INC-<n>` for incidents and `REQ-<n>`
  for requests, unique per type, generated on the server.
- Introduce real ticket states — `open`, `waiting_for_analyst`, `in_progress`, `approved`,
  `resolved` — with server-enforced transitions driven by the support actions that already
  exist (transfer, claim, return, close) plus ticket creation and reopening.
- Render the V03 agent answer as: short bubble, optional selection rows with number, title,
  status and date, and a full ticket card with eyebrow (`Chamado · INC-20311 · status`),
  title, description, and a four-field grid (Categoria, Prioridade, Aberto em, Última
  atualização with the overdue note).
- Keep the employee's authorized data boundary: numbers are shown only for the employee's
  own tickets, and analysts see numbers only for conversations they may read.

## Non-goals

- A `Recusado` state or any rejection/approval request workflow beyond the close choice.
- Analyst search by ticket number, queue redesign, or ticket detail routes.
- Public ticket numbers in URLs, analytics, notifications, or external integrations.
- Changing the SLA math, priority rules, duplicate detection, draft versioning, handoff
  reasons, session limit, or model integration.
- Native Pencil pixel equivalence and richer prototype-only data such as presence counts.

## Approaches considered

- **A. Status inferred from existing support actions without an approval choice.** Smallest
  change, but `Aprovado` would mean "closed request", so a denied request would appear
  approved.
- **B. Status workflow with an explicit analyst decision at close (chosen).** Incidents close
  as `resolved`; requests close with an explicit `Aprovado` or `Concluído` outcome. Every
  label then has a verifiable meaning. Cost: one new close choice, endpoint validation and
  more transition tests.
- **C. Only lifecycle states, `Aprovado` only in seed data.** Cheapest, but leaves one of the
  requested states unreachable.

## Status model

| Status | Label | Entered when | Leaves when |
| --- | --- | --- | --- |
| `open` | Aberto | creation; reopening a terminal ticket | handoff with context ticket, transfer confirmation, close |
| `waiting_for_analyst` | Aguardando analista | conversation handoff (employee request, critical, overdue, unresolved uncertainty) | analyst claim, close |
| `in_progress` | Em andamento | analyst claims the conversation | close; reopening is not possible while active |
| `approved` | Aprovado | analyst closes a `REQ` conversation choosing approval | reopening within seven days |
| `resolved` | Resolvido | analyst closes an `INC`, or concludes a `REQ` | reopening within seven days |

Rules:

- Only the transitions in the table change a ticket. Any other requested transition is a
  no-op: it never creates an event and never blocks the conversation action.
- `overdue` remains a computed flag, never a status. It applies only to active statuses
  (`open`, `waiting_for_analyst`, `in_progress`).
- Reopening applies to `resolved` and `approved`, within seven elapsed calendar days of the
  terminal timestamp, and returns to `open` while clearing the terminal timestamp and
  resetting the SLA clock.
- Supplements are allowed for active statuses, not for `approved`/`resolved`.
- `transferRequested` remains persisted for compatibility and history, but status is
  authoritative for display.
- Returning the conversation to the agent without closing **keeps** `in_progress`.
- A handoff or close without a linked ticket changes no ticket status.
- The project discloses that Annex B's status list is illustrative and that this table is a
  project convention, analogous to the documented SLA conventions.

## Ticket context link

`Conversation` gains a nullable `contextTicketId`. It is set:

- by the overdue automatic handoff, from the consulted ticket;
- by a confirmed `transfer` draft, from the draft's ticket;
- by any other handoff, from the latest completed agent decision when exactly one active
  ticket is in context (otherwise null).

Claim, close and reopen read this link. It persists across restart, and the analyst console
shows the linked ticket. The link never authorizes access by itself: ticket reads still
enforce employee ownership or analyst conversation authorization.

## Ticket number

- `Ticket.number Int` plus a unique constraint on `(type, number)`.
- A `TicketNumberSequence` table (`type` primary key, `value`) is incremented inside the same
  transaction that creates the ticket, so concurrent creations cannot duplicate a number.
  SQLite serializes the write, and the existing confirmation queue already serializes
  employee confirmations.
- Display format is `TYPE-` plus five digits, e.g. `INC-20311`, `REQ-10442`, produced by the
  server and sent over the wire as a string.
- Migration/backfill assigns numbers per type ordered by `createdAt, id`, starting from the
  documented base (incidents 20000, requests 10000) when an existing row has no number, then
  initializes the sequence to the current maximum.
- Seed data adopts the PRD/prototype numbers for the existing fixture tickets; new fixtures
  (for example an approved `REQ`) use numbers consistent with their type so demo captures
  stay recognizable. Existing tests keep addressing fixtures by id.
- Consultation reference matching accepts the formatted number as well as the internal id.

## Contract changes

- `TicketStatusSchema` replaces the inline `open|resolved` enums in `TicketView` and
  `ConsultationTicketView`.
- `TicketView` and `ConsultationTicketView` expose `number` as the formatted reference
  (`INC-20311`), nullable only for legacy snapshots, and `description`
  (`ConsultationTicketView` only; nullable for legacy rows). New writes always populate
  both. The database stores the integer; formatting happens on the server. The ticket card
  and selection row hide the number when it is absent instead of inventing one.
- `TicketEventView.kind` gains `status_changed`, with content in the form
  `Aberto → Aguardando analista`.
- A validated close input (`outcome: 'approved' | 'resolved'`) is required only when the
  linked ticket is a `REQ`; incidents reject the field.

## Backend changes

- Ticket creation, reopen, supplement and transfer validation move from literal `'open'`
  checks to the status predicates below in `apps/api/src/tickets`.
- Active statuses are `open`, `waiting_for_analyst` and `in_progress`. Duplicate detection
  considers active tickets duplicates of a new problem. Supplements are allowed on active
  tickets. Transfers are allowed only on `open` tickets without a pending
  `transferRequested`, and reopening clears that flag.
- `PrismaTicketService` assigns numbers and writes status events transactionally. Idempotent
  confirmation replay re-reads the current ticket by id and returns its current view without
  repeating the write, so replays still return the number and status.
- `ConversationsService.requestHandoff` resolves and stores the context ticket; the
  consultation service passes the overdue or single consulted ticket explicitly. When no
  explicit ticket exists, the link comes from the in-flight decision's tickets if exactly
  one is active, then from the latest persisted completed agent decision, and otherwise the
  previous link is kept. A handoff without a ticket never clears an existing link.
- A confirmed `transfer` draft records `transferRequested = true` and leaves the ticket
  `open`; the conversation handoff is what moves the linked ticket to
  `waiting_for_analyst`. This keeps the ticket service independent of conversation
  orchestration and never creates a waiting ticket with no queue.
- `HumanSupportService.claim` moves the linked ticket to `in_progress`, `returnToAgent`
  leaves it, and `close` applies the incident/request outcome atomically with the
  conversation close.
- Ticket state never blocks human support: conversation actions always succeed, and the
  ticket transition is a no-op when the target equals the current status, when the ticket is
  already terminal, or when no link exists. Only genuine changes write a `status_changed`
  event; the conversation action is never rolled back because the ticket could not move.
- Consultation ticket listing and the deterministic engine's status sentences use the new
  vocabulary.

## Frontend changes

- `ticket-card.tsx`: eyebrow with kind, formatted number and status; title; description
  (omitted when absent, with no invented text); four-field grid (Categoria, Prioridade,
  Aberto em, Última atualização) following `vbsNW`; and a footer line keeping the deadline
  visible ("Prazo: … · vencido") so B03's deadline evidence does not regress.
- `ticket-selection.tsx`: number before the title, status dot color per state, date retained.
- `labels.ts`: five status labels; the number arrives already formatted from the server.
- Employee navigation, draft card and analyst ticket context render the number and status;
  the analyst close control offers "Aprovar solicitação" or "Concluir atendimento" for a
  linked `REQ`.
- CSS adds status color classes (`waiting_for_analyst`, `in_progress`, `approved`) and keeps
  the responsive card grid at 375 px without horizontal overflow.

## Data and migration

- Prisma migration adds `Ticket.number`, the `(type, number)` index, `TicketNumberSequence`
  and `Conversation.contextTicketId`, then backfills numbers and sequences.
- Existing local databases keep working; backfilled numbers are stable for later runs.
- Seed/fixtures remain idempotent and never overwrite an existing ticket number.

## Testing and evidence

- Unit: number formatting, sequence allocation, allowed/blocked transitions, overdue only
  for active statuses, reopen window, close outcome validation.
- Integration (isolated database): create/duplicate/reopen; handoff sets
  `waiting_for_analyst`; claim sets `in_progress`; return keeps it; close `INC` resolves;
  close `REQ` with each outcome; unauthorized employee/analyst access; restart persistence;
  backfill of a pre-existing database.
- Browser: selection rows show number/status/date; card shows number, status and
  description; approved and resolved labels; analyst close choice; reopen; 1440×900 and
  375×812 overflow.
- Evidence updates: `docs/ticket-consultation-verification.md`,
  `docs/human-support-verification.md`, `docs/challenge-acceptance.md` (B03, B09, B11, B13,
  B14 untouched), plus the V03 capture comparison.
- Expected results come from the PRD, this convention table and the acceptance matrix —
  never from the current implementation.

## Decisions taken during review

- Legacy rows keep working: `number` is nullable in the wire schemas only for old snapshots;
  every new write sets it, and replay re-reads the ticket instead of trusting the stored
  JSON.
- Ticket-state problems never block claim, return, close or handoff; the ticket moves only
  when a real change is valid.
- A transfer without a conversation handoff leaves the ticket `open` with
  `transferRequested`; it never creates a waiting ticket with no queue.
- The context ticket is resolved by explicit handoff ticket, then the in-flight decision,
  then the latest persisted decision, and an existing link is never cleared by a later
  handoff without a ticket.
- Duplicate detection, supplements and transfers use the active-status predicates above.

## Risks and disclosures

- The PRD does not define a ticket workflow; every transition above is a documented project
  convention derived from existing actions, not a PRD quotation.
- No `Recusado` state exists, so a denied request is `resolved` with the analyst's written
  justification.
- Coupling a conversation to one ticket is a simplification; conversations can discuss
  several tickets, and only the linked one changes status.
- Decisions persisted before this change have no number; the UI omits it for those old
  snapshots rather than fabricating one, and new activity shows the real number.
- Number backfill order uses `createdAt, id`; two tickets created in the same millisecond
  still receive distinct, deterministic numbers.
- The analyst console keeps the current queue search; searching by number is future work.
