# Ticket-service verification

Issue [#5](https://github.com/kakahimita/nexo-assist/issues/5) is open. The
ticket-service increment is committed on `feature/LAB-0005`. This document
records evidence for application revision `d601223`, checked on Windows on
2026-11-02 with Node 22.23.2 and npm 10.9.8. Documentation-only changes after
that revision do not add application evidence.

## Automated checks

- `npm run typecheck`, `npm run lint`, `npm test` (89 tests in 11 files),
  `npm run test:integration` (17 tests in 7 files) and `npm run build` passed
  on `d601223`.
- `npm run check` passed every stage, including 17 Chromium tests, only with
  temporary test-only substitutions: web port 3000 to 4310, API port 3001 to
  4311, `NEXT_PUBLIC_API_BASE_URL=http://localhost:4311/api` and
  `API_BASE_URL=http://127.0.0.1:4311/api`. The substitutions were reverted and
  are not part of the delivery. A standard `npm run check` invocation could not
  start the browser stage because an existing process occupied ports 3000 and
  3001; that process was left running. This is not a passing unmodified
  invocation.
- `npm run smoke:model` was skipped because no `GOOGLE_API_KEY` was configured
  in this worktree's `.env`. Issue #5 does not require live inference. Earlier
  foundation smoke evidence remains in [foundation verification](foundation-verification.md).
- `git diff --check` was clean at the reviewed revision. The schema migration,
  confirmation race/replay paths, privacy boundaries and user-facing copy were
  reviewed manually. The stale revision in the earlier evidence draft was
  corrected to `d601223`.

## Fixtures and ticket behavior

The ticket seed is idempotent and does not overwrite existing ticket state:

- Ana has `fixture-ana-open` ("Notebook lento", incident, hardware, medium,
  open and overdue by more than two weeks) and `fixture-ana-resolved` ("Senha
  bloqueada", incident, access, medium, resolved at seed time).
- Bruno has `fixture-bruno-open` ("Acesso à VPN", request, network and VPN,
  low, open).
- No credentials are seeded. Demo login remains the fictional #4 identity
  fixture with any nonempty password.

Priority is server-derived from impact, work state and urgency. A stopped
team or company is critical; a stopped individual or a same-day commitment at
risk is high; affected work with an alternative is medium; a normal request or
improvement is low. Unknown or contradictory facts require clarification rather
than a guessed priority.

SLA calculations use `America/Sao_Paulo`, Monday-Friday 08:00-18:00, without
holidays. Critical is one elapsed hour; high, medium and low are 4, 30 and 50
business hours. Creation starts the clock; employee supplements and reads do
not reset it. A substantive support update must reset the persisted clock when
that workflow is implemented in #8. A ticket is overdue only after the exact
deadline. Resolved tickets can reopen through seven elapsed days, inclusive.

Creation, supplementation, reopening and transfer require a persisted draft
version and its operation ID. Editing creates a new version and operation ID;
stale, cancelled or already-consumed versions return a conflict. The ticket
mutation, audit event, draft consumption and replayable result commit in one
SQLite transaction. Repeating a confirmation or retrying after a lost response
returns the stored result instead of creating another ticket or event.

Bounded retries cover transient ticket failures: up to three attempts before
commit, and a post-commit failure is recovered by replaying the same operation
ID. Exhaustion returns an honest retryable error; success is never fabricated.
Validation and authorization errors are not retried.

Exact normalized-title matching blocks some duplicates for one employee. It can
block different problems that share a title and can miss the same problem
described under another title. This is a conservative temporary safeguard, not
semantic duplicate detection.

The backend can record a confirmed ticket-transfer request and its audit event.
It does not create a human support queue, assign an analyst or pause an agent;
durable conversation handoff and ownership belong to #8. Whether recording the
request alone satisfies the issue's transfer criterion remains for owner review.

## Acceptance mapping

- B03 is partial: the employee can list, select, read and see the history and
  deadline of owned tickets. Conversational selection and clarification are #6.
- B04 is demonstrated for the minimal workflow: all required fields, a visible
  draft and computed priority, confirm, edit, cancel and stale-version handling.
- B05 is partial: confirmed supplements and retried or concurrent writes commit
  once; duplicate detection is exact-title only, as described above.
- B06 is demonstrated: reopening succeeds at exactly seven elapsed days and
  fails one millisecond later or before resolution.
- B07 is demonstrated by table-driven priority tests, including incomplete and
  contradictory facts.
- B08 is partial: deadline calculation, business-hour boundaries, weekends,
  historical São Paulo offset changes and overdue status are tested. Support
  updates that restart the persisted deadline are #8.
- B13 is partial: ticket and history persistence survive an application restart.
  Conversation persistence came from #4; human ownership and waiting/assigned
  states are #8.
- B15 is partial: controlled transient read and write failures, exhaustion and
  post-commit replay are tested. Human care during model quota exhaustion is #8.
- B16 is partial: employee isolation, anonymous 401, analyst 403 and forged
  ownership fields are tested. Agent redirection of non-IT subjects is #6.
- B09-B12 and B14 are not implemented by this increment: there is no service-desk
  agent answer, decision evidence, durable handoff, analyst queue or 30-message
  session cap yet.

## Visual evidence

V02 and V03 remain partial. V02 was re-inspected at 1440 x 900 for this
verification; Task 6 inspected V02 and V03 at 1440 x 900 and 390 x 844 against
the hash-verified `.pen` frames `IcuoM`/`vbsNW` and the owner-supplied 3x
secondary renderings. The minimal ticket list, detail card and confirmation
form are usable without horizontal overflow at the narrow viewport, but the
layout differs substantially from the prototype's navigation rail, conversation
composition, action evidence and draft presentation. Application screenshots
are under the ignored local `outputs/` directory. No native Pencil export was
available, so this is not pixel-level visual acceptance.

## Remaining delivery work

- Finish owner review of the transfer interpretation and the partial B rows
  above.
- PR [#17](https://github.com/kakahimita/nexo-assist/pull/17) was merged and issue #5 was closed; the challenge-wide limitations above remain.
- Continue consultation validation in #6, conversational
  changes and the session cap in #7, and human support in #8.
- Complete the remaining UI and visual acceptance in #9 and submission evidence
  in #10.
