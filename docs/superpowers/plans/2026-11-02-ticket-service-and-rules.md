# Ticket Service and Deterministic Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Review manually unless the owner explicitly requests delegation, as required by `AGENTS.md`.

**Goal:** Provide an independently usable, persistent simulated ticket service with deterministic rules, current-draft confirmation, idempotent writes and controlled transient failures for issue #5.

**Architecture:** NestJS owns authorization, validation, rules and persistence; a typed ticket-service interface is independent of Mastra and its implementation uses Prisma/SQLite. A server-owned draft and its operation ID bind each employee confirmation to one exact version; one database transaction applies the ticket mutation, audit event and replayable result. A small authenticated Next.js interface exposes ticket consultation and create/supplement/reopen confirmation without claiming that the future agent or human queue exists.

**Tech Stack:** Node `>=22.23.2 <23`, npm `>=10.9.8 <11`, npm workspaces, strict TypeScript, NestJS, Next.js, Prisma/SQLite, Zod, Vitest, Supertest and Playwright.

**Spec:** [Issue #5](https://github.com/kakahimita/nexo-assist/issues/5), `docs/challenge-context.md`, `docs/challenge-acceptance.md` (B03–B08, B13, B15–B16; relevant parts of V02–V03), `docs/architecture.md`, `docs/development-workflow.md`, and private PRD v5 pp. 1–2, 4–5. Visual authority is the verified private `originals/nexo.pen` frames `IcuoM` and `vbsNW`; `screens/02-ticket-draft.png` and `screens/03-ticket-consultation.png` are secondary, non-native renderings (see `docs/challenge-references.md`).

**Planning baseline:** Issue #5 is open. PRs #15 and #16 were merged on GitHub; the local `main` and `origin/main` may need a fetch before starting. This plan is a proposal for review, not implementation evidence. The earlier untracked plan dated 2026-10-31 remains untouched. Before execution, preserve all existing uncommitted work, fetch the remote, and base the issue branch on the current remote `main` without overwriting the existing checkout.

## Global Constraints

- Engineering artifacts use English; user-facing copy and explanations use Brazilian Portuguese.
- Start an issue-derived `feature/LAB-0005` branch from current `main`; preserve existing local changes. The existing GitHub issue #5 is the delivery issue. Split into linked issues/PRs if an independently reviewable increment is too large; never invent LAB numbers.
- Authenticated identity comes from the server; never accept owner or analyst identity as an HTTP/model argument. Employees see only their own tickets and drafts; an analyst must not gain unrestricted employee access.
- The ticket service is independent of agent code; expose no Mastra administrative endpoints and add no model key or paid fallback.
- Required ticket data: title, description, type (`INC`/`REQ`), category (Access, Network and VPN, Hardware, Software, Email, Other), priority and affected scope. Display categories and user-facing status in Brazilian Portuguese.
- Use `America/Sao_Paulo`, Monday–Friday 08:00–18:00, no holidays; critical 1 elapsed hour, high 4 business hours, medium 30 business hours, low 50 business hours. Store instants in UTC. A ticket is overdue only after its deadline, not at the deadline.
- Creation starts the SLA clock; a substantive support update restarts it. Employee supplements, reads and automatic events do not. Reopening is allowed through exactly seven elapsed calendar days after resolution, inclusive.
- Creation, supplementation, reopening and this issue's ticket transfer require the currently displayed persisted draft version and an idempotency key. Edits invalidate previous versions; cancellation cannot commit. The operation result and audit event commit atomically with the ticket mutation.
- Treat the transfer operation as recording a ticket transfer request, reason and history; it does not claim that an analyst has received, claimed or replied to a conversation. Durable conversation handoff, ownership and agent pause are #8.
- Issue #5 says “transfer” without defining whether a recorded request alone satisfies it. Treat that interpretation as a proposal for owner review. Until agreed and demonstrated, use `Refs #5` rather than `Closes #5`; do not claim B09–B11 are complete.
- Conversation-driven matching and clarification are #6/#7. This increment blocks exact normalized-title duplicates for one employee and requires review of returned candidates. This can block distinct problems with the same title and can miss the same problem under different titles. It is a conservative temporary safeguard, not full B05 acceptance; do not claim semantic duplicate detection.
- Do not commit original challenge assets, screenshots, databases, generated files or secrets. Automated integration/browser tests use isolated temporary databases and controlled failures; live model smoke is separate.
- During execution, check each completed plan step only after recording its evidence; label a conditional skipped step with its reason rather than marking it complete.

## Review Focus

1. Concurrent confirmations with different keys or a stale version must not create a second ticket or history event (Task 4).
2. A committed operation whose response is lost must be recoverable with the same operation ID, while a reused ID for a different payload or employee must fail (Tasks 4–5).
3. A forged owner ID, another employee's ticket/draft ID or an analyst session must not disclose or modify employee data (Tasks 3–5).
4. Deadlines at closing time, weekends, exactly at expiry and across São Paulo offset changes must not use machine-local time (Task 1).
5. A cancelled/edited draft, a matching open-ticket candidate or a reopened ticket just outside seven days must not produce an unauthorized write (Tasks 1, 3–4).

---

## Scope and file map

The tasks form one service boundary and share its contract; each task below ends with an independently testable increment. If execution needs multiple PRs, create real linked issues for the increments and derive each branch from its own issue number. This plan does not make the agent, analyst queue, semantic matching or complete prototype UI part of #5.

- `apps/api/src/tickets/rules.ts`, `rules.test.ts`: priority, reopening and SLA as pure functions with an injected instant.
- `packages/contracts/src/ticket.ts`, `ticket.test.ts`, `index.ts`: strict shared wire types/schemas and discriminated draft actions.
- `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<timestamp>_tickets/migration.sql`, `apps/api/src/tickets/fixtures.ts`, `apps/api/src/database/initialize.ts`: durable tickets, history, drafts, operation results and fictional seed data.
- `apps/api/src/tickets/ticket-service.ts`, `prisma-ticket-service.ts`, `drafts.service.ts`, `failure-simulator.ts`: typed service boundary, persistence, versioned confirmation and controlled failure injection.
- `apps/api/src/tickets/tickets.controller.ts`, `tickets.module.ts`, `apps/api/src/app.module.ts`: authenticated HTTP entry points and dependency wiring.
- `apps/api/test/tickets.integration.test.ts`, `ticket-confirmation.integration.test.ts`, `ticket-failures.integration.test.ts`: isolated, deterministic database and HTTP tests.
- `apps/web/src/features/tickets/tickets.tsx`, `apps/web/src/features/history/history.tsx`, `apps/web/src/app/api/[...path]/route.ts`, `apps/web/src/app/globals.css`, `apps/web/e2e/tickets.spec.ts`: minimal employee workflow, fixed proxy allowlist and browser evidence.
- `README.md`, `docs/challenge-acceptance.md`, `docs/roadmap.md`, `docs/ticket-verification.md`: setup, scope and evidence tied to the actual tested revision.

### Task 1: Pure service-desk rules

**Files:** Create `apps/api/src/tickets/rules.ts`; test `apps/api/src/tickets/rules.test.ts`.

**Interfaces:** Produces `Priority = 'critical' | 'high' | 'medium' | 'low'`, `Impact = 'self' | 'team' | 'company' | 'unknown'`, `WorkState = 'stopped' | 'workaround' | 'request' | 'unknown'`, `Urgency = 'same_day' | 'normal' | 'unknown'`; `classifyPriority(facts: { impact: Impact; workState: WorkState; urgency: Urgency }): Priority | null`; `deadline(start: Date, priority: Priority): Date`; `isOverdue(due: Date, now: Date): boolean`; `canReopen(resolvedAt: Date, now: Date): boolean`. `null` means clarification is needed, never a guessed priority.

- [x] Write table-driven B07/B08/B06 tests using these assertions:

  ```ts
  expect(classifyPriority({ impact: 'team', workState: 'stopped', urgency: 'normal' })).toBe('critical');
  expect(classifyPriority({ impact: 'self', workState: 'stopped', urgency: 'normal' })).toBe('high');
  expect(classifyPriority({ impact: 'self', workState: 'workaround', urgency: 'same_day' })).toBe('high');
  expect(classifyPriority({ impact: 'self', workState: 'workaround', urgency: 'normal' })).toBe('medium');
  expect(classifyPriority({ impact: 'self', workState: 'request', urgency: 'normal' })).toBe('low');
  expect(classifyPriority({ impact: 'unknown', workState: 'stopped', urgency: 'normal' })).toBeNull();
  expect(classifyPriority({ impact: 'self', workState: 'request', urgency: 'same_day' })).toBe('high');
  const friday = new Date('2026-10-30T20:00:00.000Z'); // 17:00 São Paulo
  expect(deadline(friday, 'critical').toISOString()).toBe('2026-10-30T21:00:00.000Z');
  expect(deadline(friday, 'high').toISOString()).toBe('2026-11-02T14:00:00.000Z');
  expect(deadline(friday, 'medium').toISOString()).toBe('2026-11-04T20:00:00.000Z');
  expect(deadline(friday, 'low').toISOString()).toBe('2026-11-06T20:00:00.000Z');
  expect(isOverdue(new Date('2026-11-02T14:00:00Z'), new Date('2026-11-02T14:00:00Z'))).toBe(false);
  expect(isOverdue(new Date('2026-11-02T14:00:00Z'), new Date('2026-11-02T14:00:00.001Z'))).toBe(true);
  expect(canReopen(new Date('2026-10-01T12:00:00Z'), new Date('2026-10-08T12:00:00Z'))).toBe(true);
  expect(canReopen(new Date('2026-10-01T12:00:00Z'), new Date('2026-10-08T12:00:00.001Z'))).toBe(false);
  expect(canReopen(new Date('2026-10-01T12:00:00Z'), new Date('2026-09-30T12:00:00Z'))).toBe(false);
  ```

- [x] Add B08 tests asserting that high priority starting Friday exactly at closing (`2026-10-30T21:00:00Z`) is due Monday `2026-11-02T15:00:00Z`, and that high priority starting Friday `2019-02-15T19:00:00Z` is due Monday `2019-02-18T14:00:00Z` across the historical São Paulo offset change. Assert that passing a later support-update instant to `deadline` changes the deadline; Task 4 verifies an employee supplement does not reset the persisted clock. These values use the IANA zone, not the host time zone.
- [x] Run `npm test`; expect failure because `rules.ts` and its exports do not exist.
- [x] Implement the interfaces above. Require all three facts to be known. Critical takes precedence for a stopped team/company; high for a stopped individual or a same-day commitment at risk, including a request; medium for a workaround; low for a normal request. Here `same_day` specifically means a same-day commitment is at risk, not merely that someone prefers a same-day response. Use an IANA-zone-aware calculation, not a fixed UTC offset, and do not mutate input dates.
- [x] Run `npm test`; expect all unit tests to pass. Commit with `feat: add deterministic service desk rules`.

### Task 2: Shared contracts and persisted ticket records

**Files:** Create `packages/contracts/src/ticket.ts`, `packages/contracts/src/ticket.test.ts`, `apps/api/src/tickets/fixtures.ts`, and a Prisma migration; modify `packages/contracts/src/index.ts`, `apps/api/prisma/schema.prisma`, `apps/api/src/database/initialize.ts`; test `apps/api/test/database.integration.test.ts`.

**Interfaces:** Produces strict Zod schemas and inferred types `TicketView`, `TicketEventView`, `DraftInput`, `DraftView`, `ConfirmDraftInput`. `DraftInput` is a discriminated union: `{ action: 'create', title, description, type, category, impact, workState, urgency }`, `{ action: 'supplement', ticketId, content }`, `{ action: 'reopen', ticketId, reason }`, or `{ action: 'transfer', ticketId, reason }`. Text fields are trimmed, nonempty and at most 4000 characters; title at most 200. `DraftView` contains `id`, `version` (positive integer), `operationId` (UUID), `status: 'pending' | 'cancelled' | 'committed'` and the exact validated `input`; create drafts also include server-calculated `priority` and `candidates: TicketView[]`. `ConfirmDraftInput` is strictly `{ version: number; operationId: string }`. `TicketView` exposes `id`, `ownerId`, `title`, `description`, `type`, `category`, `priority`, `impact`, `status: 'open' | 'resolved'`, `transferRequested: boolean`, `createdAt`, `resolvedAt: string | null`, `slaStartedAt`, `deadline`, `overdue`; timestamps are ISO UTC strings. `TicketEventView` exposes `id`, `ticketId`, `kind: 'created' | 'supplemented' | 'reopened' | 'transfer_requested' | 'support_updated'`, `content`, `createdAt`. A duplicate-conflict body is strict `{ code: 'duplicate_candidates', candidates: TicketView[] }`.

- [ ] Write contract tests that accept each action and reject unknown fields including `ownerId`, malformed UUIDs, empty/oversized text, unknown categories and nonpositive versions. Write an initialization test that runs twice and checks stable fictional tickets for Ana and Bruno, including open and recently resolved states; no duplicates are seeded.
- [ ] Run `npm test` and `npm run test:integration`; expect failures for missing schemas and models.
- [ ] Add Prisma `Ticket`, `TicketEvent`, `TicketDraft`, `TicketDraftVersion`, and `TicketOperation` models and a migration. Persist UTC dates, immutable event data, draft owner/status/current version, an immutable action snapshot and UUID per version, and unique operation UUID plus owner, draft/version, request fingerprint and serialized result. Add foreign keys and indexes for owner, ticket and draft lookup. Store normalized ticket title and add a SQLite partial unique index on `(ownerId, normalizedTitle) WHERE status = 'open'`; handle its conflict as duplicate candidates. Initialize fixtures idempotently without overwriting existing ticket state on restart, using a resolution instant within seven days of initial seeding; seed no credentials.
- [ ] Implement/export the exact wire schemas and types above. Ticket status, priority and overdue are server-derived; reject client-supplied derived or ownership fields.
- [ ] Run `npm test` and `npm run test:integration`; expect all passing. Commit with `feat: persist ticket records and contracts`.

### Task 3: Authorized consultation and editable drafts

**Files:** Create `apps/api/src/tickets/ticket-service.ts`, `prisma-ticket-service.ts`, `drafts.service.ts`, `tickets.controller.ts`, `tickets.module.ts`, `apps/api/test/tickets.integration.test.ts`; modify `apps/api/src/app.module.ts`.

**Interfaces:** Consumes Task 2 contracts and guard-provided `UserView`. Produces `TicketService.list(user: UserView, now: Date): Promise<TicketView[]>`, `get(user: UserView, id: string, now: Date): Promise<TicketView>`, `history(user: UserView, id: string): Promise<TicketEventView[]>`; `DraftsService.create(user: UserView, input: DraftInput): Promise<DraftView>`, `get(user: UserView, id: string): Promise<DraftView>`, `edit(user: UserView, id: string, expectedVersion: number, input: DraftInput): Promise<DraftView>`, `cancel(user: UserView, id: string, expectedVersion: number): Promise<DraftView>`. HTTP: `GET /api/tickets`, `GET /api/tickets/:id`, `GET /api/tickets/:id/history`, `POST /api/ticket-drafts`, `GET /api/ticket-drafts/:id`, `POST /api/ticket-drafts/:id/edit` with strict `{ version, input }`, and `POST /api/ticket-drafts/:id/cancel` with strict `{ version }`.

- [ ] Write B03/B04/B13/B16 integration tests: Ana can list/read only her fixtures; Bruno cannot read Ana's ticket, history or draft by ID (404); anonymous gets 401 and analyst gets 403; forged `ownerId` gets 400. The ticket and ordered history survive closing and recreating Nest against the same isolated database. Empty lists return `[]`.
- [ ] Write tests that an incomplete/contradictory create draft returns 400 without a row, a valid edit increments `version` and changes `operationId`, editing with the previous version returns 409, and cancel leaves no ticket or history mutation. A pending create draft lists same-owner open tickets with matching normalized title as candidates. The unique index permits at most one exact normalized-title open match; test it and ensure another employee's same-title ticket never appears.
- [ ] Run `npm run test:integration`; expect missing-route failures.
- [ ] Implement ownership-scoped queries and strict request parsing. Normalize a duplicate candidate's title by Unicode NFKC, trim, collapse whitespace and lowercase; include candidate views in create `DraftView` without exposing another employee's records. Persist drafts independently of ticket writes; store the server-derived priority on a valid create draft. Confirmation returns the structured 409 conflict from Task 2 when a match exists.
- [ ] Run `npm run test:integration`; expect all passing. Commit with `feat: add authorized ticket consultation and drafts`.

### Task 4: Atomic confirmation, history and replay

**Files:** Modify `apps/api/src/tickets/ticket-service.ts`, `prisma-ticket-service.ts`, `drafts.service.ts`, `tickets.controller.ts`; create `apps/api/test/ticket-confirmation.integration.test.ts`.

**Interfaces:** Produces `DraftsService.confirm(user: UserView, draftId: string, input: ConfirmDraftInput, now: Date): Promise<TicketView>` and `POST /api/ticket-drafts/:id/confirm`; use the persisted operation ID returned in the current `DraftView`. Service mutations are accessible only through confirmation, not direct public ticket-write routes.

Extend `TicketService` with `confirm(user: UserView, draftId: string, input: ConfirmDraftInput, now: Date): Promise<TicketView>` for the internal confirmation boundary. `DraftsService.confirm` delegates to that interface, so future agent callers do not depend on the Prisma implementation or bypass approval.

- [ ] Write B04–B06 tests: confirming a valid create returns its ticket and one `created` event; a second identical confirmation returns the same ticket and leaves one event. Confirming a stale, cancelled or already-consumed draft with a different operation ID returns 409 and changes nothing. Reusing an operation ID for another employee, draft, version or payload returns 409 without exposing the stored result.
- [ ] Write concurrency tests using `Promise.allSettled`: simultaneous identical confirmations return the same result and create one ticket/event; simultaneous confirmations of one draft with different keys cannot create a second write. Simulate two concurrent create drafts with the same owner's normalized title and assert at most one open ticket is committed. Check database rows and event counts, not only HTTP bodies.
- [ ] Write fixed-clock tests: supplement adds one `supplemented` event without resetting `slaStartedAt`; reopen a resolved owned ticket at exactly seven elapsed days succeeds, one millisecond later returns 409; transfer adds one `transfer_requested` event and sets `transferRequested` without claiming an analyst or resuming/pausing a conversation. Another employee's ticket IDs return 404.
- [ ] Test reopening a resolved ticket when the same owner already has an open ticket with the same normalized title: return the duplicate-candidate conflict, leave both tickets unchanged, and add no event. Test a replay after restart with the original operation ID, and a replay with a modified version or another owner's session: return the stored result only for the original request.
- [ ] Run `npm run test:integration`; expect failures for the missing confirmation operation.
- [ ] Implement a single SQLite transaction for version/status check, owner authorization, duplicate recheck, action preconditions, ticket mutation, audit event, draft consumption and operation result. Compare-and-set the pending version so concurrent requests cannot both commit. On replay, check the stored owner/draft/version/fingerprint before returning the stored result, including after restart. A conflict never creates an event. For reopen set status `open`, clear `resolvedAt` and start the new SLA clock at `now`; for transfer preserve the current SLA clock.
- [ ] Run `npm run test:integration`; expect all passing. Commit with `feat: confirm ticket changes atomically`.

### Task 5: Controlled transient failures and safe recovery

**Files:** Create `apps/api/src/tickets/failure-simulator.ts`, `apps/api/test/ticket-failures.integration.test.ts`; modify `prisma-ticket-service.ts`, `drafts.service.ts`, `tickets.module.ts`.

**Interfaces:** Produces injectable `FailureSimulator.beforeOperation(): void` and `FailureSimulator.afterCommit(): void`; default implementation does nothing. A test-only scripted implementation can fail a specified number of calls before commit or once after commit with `TransientTicketError`. The confirmation boundary returns HTTP 503 after at most three attempts; each retry uses the same persisted operation ID. No public endpoint accepts a failure-injection setting.

- [ ] Write B15 integration tests: two pre-commit transient failures then success cause one ticket and one event; three pre-commit failures return 503 and leave neither; one post-commit failure followed by the automatic retry returns the stored result with one ticket/event. Separately, discard the response after a successful commit, recreate Nest, retry the same request and assert the result and event survive. A read that fails twice then succeeds returns the real tickets; three read failures return 503 with no fabricated data. A non-transient validation/authorization error is never retried.
- [ ] Run `npm run test:integration`; expect the injected failure cases to fail before the simulator/retry exists.
- [ ] Implement bounded retry for reads and confirmation outside the transaction, preserving draft version and operation ID; treat a SQLite busy/locked transaction conflict as transient. Call the post-commit hook only after the operation result has been committed. Return an honest retryable error on exhaustion and do not fabricate success.
- [ ] Run `npm run test:integration`; expect all passing. Commit with `feat: recover safely from transient ticket failures`.

### Task 6: Minimal employee ticket workflow

**Files:** Create `apps/web/src/features/tickets/tickets.tsx`, `apps/web/e2e/tickets.spec.ts`; modify `apps/web/src/features/history/history.tsx`, `apps/web/src/app/api/[...path]/route.ts`, `apps/web/src/app/globals.css`.

**Interfaces:** Consumes Tasks 2–5 HTTP endpoints and schemas. `Tickets({ onUnauthorized }: { onUnauthorized: () => void }): React.JSX.Element` displays the authenticated employee's ticket list, details and audit history, plus accessible create/supplement/reopen draft forms, confirmation, edit and cancellation. Persist the pending draft ID in browser session storage and reload its `DraftView` from the server; always use its current `operationId` on retries. Expand the proxy's fixed allowlist only for the exact ticket/draft routes and methods above; preserve same-origin and cookie protections.

- [ ] Write Playwright tests: Ana can inspect a ticket's status/deadline, create a complete draft, see all required fields and computed priority before confirming, edit then confirm the new version, reload and see one ticket/history entry; cancel another draft without a write. Bruno cannot see Ana's ticket. Exercise a 503 followed by retry without duplicate creation and show a Portuguese error when the service stays unavailable. Provide keyboard labels and visible loading, empty and error states.
- [ ] Run `npm run build` and `npm run test:e2e`; expect the new workflow test to fail before the interface exists. Use the existing isolated browser database; do not stop another person's server to free ports.
- [ ] Read `apps/web/AGENTS.md` and the installed Next.js documentation relevant to route handlers before changing web code. Implement `Tickets` and mount it for employees alongside existing history, keeping the current login and history usable. Show duplicate candidates and require selecting a candidate for a supplement or editing the title; never silently create when the server returns a conflict. Do not show an operational analyst-transfer control until #8 implements the actual handoff.
- [ ] Extend the fixed proxy allowlist for only `tickets`, `tickets/:id`, `tickets/:id/history`, `ticket-drafts`, `ticket-drafts/:id`, and the `edit`, `cancel`, `confirm` suffixes. Forward POST JSON and cookies exactly as the existing proxy does; reject all other routes and cross-origin writes.
- [ ] Run `npm run build` and `npm run test:e2e`; expect all passing. Compare the app at 1440 × 900 and a narrow viewport with verified frames `IcuoM`/`vbsNW` and their secondary images; record deliberate partial UI and native-export limitations. Commit with `feat: add employee ticket workflow`.

### Task 7: Delivery evidence and manual review

**Files:** Create `docs/ticket-verification.md`; modify `README.md`, `docs/challenge-acceptance.md`, `docs/roadmap.md`.

**Interfaces:** Consumes Tasks 1–6; produces setup instructions and evidence tied to the tested revision. Mark only demonstrated portions of B03–B08, B13, B15–B16 and V02–V03; preserve future #6–#9 scope.

- [ ] Document fixture identities, ticket examples, current-confirmation/idempotency behavior, time-zone and SLA conventions, simulated failure recovery, both false-positive and false-negative exact-title matching limitations, and that ticket transfer recording does not constitute a human conversation handoff. State that actual support updates resetting the persisted SLA and analyst authorization belong to #8; this delivery provides the deadline calculation, not an unprotected support-update endpoint.
- [ ] Run `npm run check` after installing Chromium. Expect typecheck, lint, unit, integration, build and browser stages to pass; record each actual result and any failure or skip. If existing ports are occupied, preserve the running process and explicitly document any alternate-port verification; never label a failed standard command as passed.
- [ ] Run `npm run smoke:model` only when a local provider key is already available; record a skip otherwise. This issue does not require live inference.
- [ ] Manually review the final diff, schema migration, confirmation race/replay cases, privacy, copy and source integrity; run `git diff --check`. Record exact revision, commands, test counts and visual reference limitations in `docs/ticket-verification.md`.
- [ ] Commit with `docs: record ticket service verification`. Prepare a small issue-linked PR using the repository template; use `Closes #5` only when every issue criterion is demonstrated. Do not merge without explicit owner instruction.
