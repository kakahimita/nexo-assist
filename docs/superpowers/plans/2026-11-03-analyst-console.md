# Analyst Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give analysts the queue, claim, reply, return, and close operations on top of the durable handoff lifecycle from #29, and show analyst replies to the employee as ordinary thread messages.

**Architecture:** A new `human-support` NestJS module owns analyst authorization and the state transitions (`waiting_for_analyst` -> `with_analyst` -> `agent`/`closed`), all as conditional `updateMany` transitions that increment `stateVersion`. The web app gains a role-gated analyst console and extends the employee chat to treat `with_analyst` and `closed` correctly. Analyst replies are plain persisted messages (no model call).

**Tech Stack:** TypeScript, NestJS, Prisma 7 with SQLite, Zod, Vitest, Next.js, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-analyst-console-design.md`

## Global Constraints

- Authenticated identity comes only from `IdentityGuard`; request bodies never carry an analyst or employee ID.
- Conversation states are exactly `agent`, `waiting_for_analyst`, `with_analyst`, `closed`; claim/return/close are conditional `updateMany` transitions that increment `stateVersion`.
- Only the assigned analyst may reply, return, or close; claim is the transition that assigns.
- Analyst replies are plain persisted `Message` rows (role `analyst`), never a model call — they keep working under quota exhaustion (B15).
- Analysts may read only support conversations and their associated employee tickets; employees reach nothing under `/api/support`.
- Shared Zod contracts through `packages/contracts`; strict TypeScript; the simulated ticket service stays behind its typed interface.
- UI copy is Brazilian Portuguese; code, contracts, commits, and engineering docs are English.
- Tests use isolated temporary SQLite databases; no model key is required in CI.

## Review Focus

1. A claim racing another claim or a handoff must yield exactly one owner (atomicity).
2. A return or close must not let a stale in-flight agent write land afterward (stateVersion guard).
3. An analyst cannot reply/return/close a conversation they do not own, but can claim any waiting conversation.
4. A non-analyst (employee or guest) cannot reach any `/api/support` endpoint.
5. A claim must not re-expose the employee's "Falar com analista" control (the employee treats `with_analyst` like `waiting_for_analyst`).

---

### Task 1: Extend the lifecycle contracts, schema, and read views

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_analyst_ownership/migration.sql` (generated)
- Modify: `packages/contracts/src/conversation.ts`
- Create: `packages/contracts/src/support.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/conversation.test.ts`
- Create: `apps/api/src/conversations/message-view.ts`
- Modify: `apps/api/src/conversations/conversations.service.ts`
- Modify: `apps/api/test/handoff.integration.test.ts` (only if a strict snapshot breaks)

**Interfaces:**
- Consumes: current `Conversation`, `Message`, `Ticket` rows; the existing `MessageViewSchema` mapping in `conversations.service.ts`.
- Produces: `ConversationState` including `with_analyst` and `closed`; `ConversationView` with `assignedAnalystId` and `closedAt`; `MessageView` with role `analyst` and `authorName`; `toMessageView(row)` helper; `SupportConversationSummarySchema`, `SupportConversationViewSchema`, `SupportConversationFilterSchema`, `SupportReplyInputSchema`.

- [ ] **Step 1: Write failing contract tests for the extended lifecycle**

In `packages/contracts/src/conversation.test.ts`, add cases: parse a `ConversationView` whose `state` is `'with_analyst'` with `assignedAnalystId` set and `closedAt` null; parse a `closed` view with `closedAt` an ISO date and `assignedAnalystId` set; parse a `MessageView` with `role: 'analyst'` and `authorName: 'Rafael Lima'`; reject `state: 'unknown'`, a missing `assignedAnalystId`, and `authorName` on an `agent` message. In `packages/contracts/src/support.test.ts` (new), parse a `SupportConversationSummarySchema` with `employee` and `lastMessage` null, and a `SupportConversationViewSchema` with `messages` and `tickets` arrays.

- [ ] **Step 2: Run the contract tests to verify they fail**

Run: `npm test -- packages/contracts/src/conversation.test.ts packages/contracts/src/support.test.ts`

Expected: FAIL — the new states, fields, and support schemas do not exist.

- [ ] **Step 3: Extend `ConversationStateSchema`, `ConversationViewSchema`, and `MessageViewSchema`**

In `packages/contracts/src/conversation.ts`, widen `ConversationStateSchema` to `['agent', 'waiting_for_analyst', 'with_analyst', 'closed']`, add `assignedAnalystId: z.string().nullable()` and `closedAt: z.string().datetime().nullable()` to `ConversationViewSchema`, widen `MessageViewSchema.role` to `['employee', 'agent', 'analyst']`, and add `authorName: z.string().nullable()` to `MessageViewSchema`.

- [ ] **Step 4: Add the support contracts**

Create `packages/contracts/src/support.ts` exporting:
- `SupportConversationFilterSchema = z.enum(['all', 'waiting', 'owned'])`
- `SupportConversationSummarySchema = z.strictObject({ id: z.string(), state: ConversationStateSchema, stateVersion: z.number().int().nonnegative(), employee: z.strictObject({ id: z.string(), name: z.string() }), handoff: HandoffViewSchema.nullable(), assignedAnalystId: z.string().nullable(), lastMessage: z.strictObject({ content: z.string(), role: z.enum(['employee', 'agent', 'analyst']), createdAt: z.string().datetime() }).nullable() })`
- `SupportConversationViewSchema = z.strictObject({ conversation: SupportConversationSummarySchema, messages: z.array(MessageViewSchema), tickets: z.array(TicketViewSchema) })`
- `SupportReplyInputSchema = z.strictObject({ content: z.string().max(4000).refine((v) => v.trim().length > 0) })`

Re-export all of `support.ts` from `packages/contracts/src/index.ts` (`export * from './support.js';`).

- [ ] **Step 5: Run the contract tests to verify they pass**

Run: `npm test -- packages/contracts/src/conversation.test.ts packages/contracts/src/support.test.ts`

Expected: PASS.

- [ ] **Step 6: Add the schema fields and a committed migration**

In `apps/api/prisma/schema.prisma`, add to `Conversation` `assignedAnalystId String?`, `closedAt DateTime?`, and `assignedAnalyst User? @relation("AssignedConversations", fields: [assignedAnalystId], references: [id])`; add to `Message` `authorId String?` and `author User? @relation("MessageAuthor", fields: [authorId], references: [id])`; add to `User` `assignedConversations Conversation[] @relation("AssignedConversations")` and `authoredMessages Message[] @relation("MessageAuthor")`. Generate and commit the migration (`add_analyst_ownership`).

- [ ] **Step 7: Extract the shared message mapper**

Create `apps/api/src/conversations/message-view.ts` exporting `toMessageView(row: { id: string; content: string; createdAt: Date; role: string; status: string; decision: unknown; author: { name: string } | null }): MessageView` that maps role/status/decision JSON and `authorName = row.author?.name ?? null` exactly as `ConversationsService.messages` does today. Update `ConversationsService.messages` to `include: { decision: true, author: true }` and delegate to `toMessageView`.

- [ ] **Step 8: Add the new fields to the conversation read view**

In `apps/api/src/conversations/conversations.service.ts`, extend `conversationView` to read `assignedAnalystId` and `closedAt` and pass them through `ConversationViewSchema` (both `?? null`).

- [ ] **Step 9: Run focused tests to verify they pass**

Run: `npm test -- packages/contracts/src/conversation.test.ts packages/contracts/src/support.test.ts && npm run test:integration -- apps/api/test/handoff.integration.test.ts`

Expected: PASS (existing handoff tests still green with the widened state enum and nullable fields).

- [ ] **Step 10: Commit Task 1**

```bash
git add apps/api/prisma apps/api/src/conversations packages/contracts/src
git commit -m "feat: extend conversation lifecycle for analyst ownership"
```

### Task 2: Analyst queue and detail API

**Files:**
- Create: `apps/api/src/human-support/human-support.module.ts`
- Create: `apps/api/src/human-support/human-support.service.ts`
- Create: `apps/api/src/human-support/human-support.controller.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/tickets/ticket-service.ts`
- Modify: `apps/api/src/tickets/prisma-ticket-service.ts`
- Modify: `apps/web/src/app/api/[...path]/route.ts`
- Create: `apps/api/test/support.integration.test.ts`

**Interfaces:**
- Consumes: Task 1's `SupportConversationSummarySchema`/`SupportConversationViewSchema` and `toMessageView`; `ConversationsService`; `TicketService.listForAnalyst`.
- Produces: `HumanSupportService.queue(user, filter)` -> `SupportConversationSummary[]`; `HumanSupportService.detail(user, conversationId)` -> `SupportConversationView`; `assertAnalyst(user)`; `TicketService.listForAnalyst(user, ownerId, now)` -> `TicketView[]`.

- [ ] **Step 1: Write failing integration tests for the queue and detail**

In `apps/api/test/support.integration.test.ts`, log in as `ana.souza@nexo.com.br`, create a conversation, POST `/api/conversations/:id/handoff` with `{ reason: 'employee_request' }`. Then, as `analista@nexo.com.br`, assert `GET /api/support/conversations?filter=waiting` returns one item with `state: 'waiting_for_analyst'`, `employee.name: 'Ana Souza'`, and `handoff.reason: 'employee_request'`; `GET /api/support/conversations/:id` returns `conversation`, `messages` (the employee's messages), and `tickets` (Ana's seeded tickets). Assert `GET /api/support/conversations` as Ana returns `403`, and as Bruno returns `403`.

- [ ] **Step 2: Run the support integration test to verify it fails**

Run: `npm run test:integration -- apps/api/test/support.integration.test.ts`

Expected: FAIL — the `/api/support` module and endpoints do not exist.

- [ ] **Step 3: Add analyst authorization and the analyst ticket read**

In `apps/api/src/tickets/ticket-service.ts`, add `export function assertAnalyst(user: UserView): void` (throw `ForbiddenException` when `user.role !== 'analyst'`) and add `abstract listForAnalyst(user: UserView, ownerId: string, now: Date): Promise<TicketView[]>` to `TicketService`. Implement it in `PrismaTicketService` (assert analyst, query `ticket.findMany({ where: { ownerId } })`, map via `this.view`).

- [ ] **Step 4: Implement `HumanSupportService.queue` and `HumanSupportService.detail`**

Create `human-support.service.ts` with `assertAnalyst` at the top of each method. `queue` maps the filter (`waiting` -> `state: 'waiting_for_analyst'`; `owned` -> `state: 'with_analyst'` and `assignedAnalystId: user.id`; `all` -> `state: { in: ['waiting_for_analyst', 'with_analyst'] }`), includes the owner and the latest message (order `createdAt desc`), and returns `SupportConversationSummarySchema` items. `detail` loads the conversation (must be `waiting_for_analyst` or `with_analyst`), its messages via `toMessageView`, and the owner's tickets via `listForAnalyst`, and returns `SupportConversationViewSchema`. Use `NotFoundException` for missing or `agent`/`closed` conversations.

- [ ] **Step 5: Wire the module and controller**

Create `human-support.controller.ts` with `@Controller('support') @UseGuards(IdentityGuard)` exposing `GET /` (query `filter` validated against `SupportConversationFilterSchema`, default `'all'`) and `GET /:id`. Register `HumanSupportModule` in `app.module.ts` (after `TicketsModule`).

- [ ] **Step 6: Extend the web proxy allowlist**

In `apps/web/src/app/api/[...path]/route.ts`, add `const supportRead = request.method === 'GET' && /^support\/conversations(?:\/[a-z0-9]+)?$/.test(route);` and include it in the forwarding condition.

- [ ] **Step 7: Run the support integration test to verify it passes**

Run: `npm run test:integration -- apps/api/test/support.integration.test.ts`

Expected: PASS — queue, detail, and the employee `403`s are green.

- [ ] **Step 8: Commit Task 2**

```bash
git add apps/api/src/human-support apps/api/src/tickets apps/api/src/app.module.ts apps/web/src/app/api
git commit -m "feat: add analyst queue and conversation detail API"
```

### Task 3: Claim, reply, return, and close

**Files:**
- Modify: `apps/api/src/human-support/human-support.service.ts`
- Modify: `apps/api/src/human-support/human-support.controller.ts`
- Modify: `apps/api/src/identity/fixtures.ts`
- Modify: `apps/web/src/app/api/[...path]/route.ts`
- Modify: `apps/api/test/support.integration.test.ts`
- Modify: `apps/api/test/consultation-stream.integration.test.ts`

**Interfaces:**
- Consumes: Task 2's `queue`/`detail`; the `stateVersion` guard pattern from `ConversationsService.requestHandoff`.
- Produces: `HumanSupportService.claim(user, conversationId)` -> `SupportConversationSummary`; `reply(user, conversationId, content)` -> `MessageView`; `returnToAgent(user, conversationId)` -> `SupportConversationSummary`; `close(user, conversationId)` -> `SupportConversationSummary`.

- [ ] **Step 1: Add a second analyst fixture and write failing transition tests**

In `apps/api/src/identity/fixtures.ts`, add `{ email: 'rafael.lima@nexo.com.br', name: 'Rafael Lima', role: 'analyst' }`. In `apps/api/test/support.integration.test.ts`, after the handoff from Task 2, as the analyst: `claim` returns `state: 'with_analyst'`, `assignedAnalystId` equal to the analyst id, `stateVersion: 2`; a second `claim` by the same analyst is `409`; `reply` with `{ content: 'Já li o histórico' }` returns a `MessageView` with `role: 'analyst'` and `authorName: 'Analista'`; as Ana, `GET /api/conversations/:id/messages` now includes that analyst message; `reply`/`return`/`close` as `rafael.lima@nexo.com.br` (unassigned) is `403`; `return` returns `state: 'agent'` and null `assignedAnalystId`; re-handoff then `claim` then `close` returns `state: 'closed'` with `closedAt` set.

- [ ] **Step 2: Run the transition tests to verify they fail**

Run: `npm run test:integration -- apps/api/test/support.integration.test.ts`

Expected: FAIL — claim/reply/return/close are not implemented.

- [ ] **Step 3: Write a failing stale-output test for claim/return**

In `apps/api/test/consultation-stream.integration.test.ts`, add a case using a controllable engine that yields one delta then blocks. Start the employee stream, then have the analyst `claim` (or, after return, the guard must still hold), release the engine, and assert no late agent message is persisted (the `stateVersion` guard rejects it) and the conversation is `with_analyst`.

- [ ] **Step 4: Run the stale-output test to verify it fails**

Run: `npm run test:integration -- apps/api/test/consultation-stream.integration.test.ts`

Expected: FAIL if claim/return does not yet change the guarded state/version.

- [ ] **Step 5: Implement the four transitions**

In `human-support.service.ts`, implement each as a transaction with a conditional `updateMany`:
- `claim`: from `state: 'waiting_for_analyst'` at the current `stateVersion`, set `state: 'with_analyst'`, `assignedAnalystId: user.id`, `stateVersion: { increment: 1 }`; map zero rows to `ConflictException`.
- `reply`: verify `state: 'with_analyst'` and `assignedAnalystId === user.id`, then create a `Message` with `role: 'analyst'`, `authorId: user.id`, `status: 'completed'`.
- `returnToAgent`: from `state: 'with_analyst'` and `assignedAnalystId === user.id`, set `state: 'agent'`, `assignedAnalystId: null`, `stateVersion: { increment: 1 }`.
- `close`: from `state: 'with_analyst'` and `assignedAnalystId === user.id`, set `state: 'closed'`, `closedAt: now`, `stateVersion: { increment: 1 }`.

Each returns the corresponding contract view (reuse `queue`/`detail`'s summary mapping).

- [ ] **Step 6: Wire the endpoints and proxy**

Add to `human-support.controller.ts` `POST /:id/claim`, `POST /:id/reply` (validate `SupportReplyInputSchema`), `POST /:id/return`, `POST /:id/close`; each with no body except `reply`. Extend the proxy allowlist with `supportWrite` matching `^support\/conversations\/[a-z0-9]+\/(claim|reply|return|close)$`.

- [ ] **Step 7: Run the focused integration tests to verify they pass**

Run: `npm run test:integration -- apps/api/test/support.integration.test.ts apps/api/test/consultation-stream.integration.test.ts`

Expected: PASS — transitions, authorization, atomicity, and stale-output rejection are green.

- [ ] **Step 8: Commit Task 3**

```bash
git add apps/api/src/human-support apps/api/test apps/web/src/app/api
git commit -m "feat: add analyst claim reply return and close"
```

### Task 4: Employee-side states and analyst message rendering

**Files:**
- Modify: `apps/web/src/features/consultation/consultation.tsx`
- Modify: `apps/web/src/features/consultation/stream.test.ts`
- Modify: `apps/web/src/features/history/history.tsx`

**Interfaces:**
- Consumes: Task 1's widened `ConversationView` (states) and `MessageView` (`analyst` role, `authorName`).
- Produces: employee chat treats `waiting_for_analyst` and `with_analyst` as "human engaged" and `closed` as terminal; analyst messages render with the author name and a "Suporte" tag.

- [ ] **Step 1: Write a failing component test for the new states**

In `apps/web/src/features/consultation/stream.test.ts`, add a case that a `MessageView` with `role: 'analyst'` and `authorName` parses, and that the consultation component does not render a "Falar com analista" control when the conversation `state` is `'with_analyst'` (mirror the existing waiting-state assertion).

- [ ] **Step 2: Run the web test to verify it fails**

Run: `npm test -- apps/web/src/features/consultation/stream.test.ts`

Expected: FAIL — the `with_analyst` state and analyst message rendering are not handled.

- [ ] **Step 3: Treat `with_analyst` and `closed` in the employee chat**

In `consultation.tsx`, derive `const humanEngaged = conversation.state === 'waiting_for_analyst' || conversation.state === 'with_analyst';` and use it in place of the current `waiting` check (initial state, the `handoff-waiting` branch, the handoff control, and the composer). Add a `closed` branch that renders `Atendimento encerrado.` and a "Nova conversa" action, hiding the composer and handoff control. Keep employee messages persistable while `humanEngaged`.

- [ ] **Step 4: Render analyst messages**

In `consultation.tsx`, when `message.role === 'analyst'`, render the sender as `message.authorName` with a "Suporte" tag instead of "Nexo Assist"; keep `employee` and `agent` unchanged.

- [ ] **Step 5: Run the web tests to verify they pass**

Run: `npm test -- apps/web/src/features/consultation/stream.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add apps/web/src/features/consultation apps/web/src/features/history
git commit -m "feat: handle analyst and closed states in the employee chat"
```

### Task 5: Analyst console UI and browser workflow

**Files:**
- Create: `apps/web/src/features/support/support.tsx`
- Modify: `apps/web/src/features/history/history.tsx`
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/e2e/support.spec.ts`

**Interfaces:**
- Consumes: `/api/support/conversations` (`filter`), `/api/support/conversations/:id`, and the claim/reply/return/close endpoints; Task 4's message rendering.
- Produces: a role-gated analyst console with a filterable list, a conversation thread, a takeover bar, and the employee ticket panel.

- [ ] **Step 1: Write a failing browser workflow**

In `apps/web/e2e/support.spec.ts`, log in as Ana, create a conversation and request human support; then log out and in as `analista@nexo.com.br`, assert the "Para você" list shows Ana's conversation, click "Assumir atendimento", assert the composer becomes enabled and the "Você está atendendo" marker appears, type and send a reply, assert it appears in the thread; reload the employee side and assert the reply is visible; click "Encerrar atendimento" and assert the closed state.

- [ ] **Step 2: Run the browser workflow to verify it fails**

Run: `npm run build && npm run test:e2e`

Expected: FAIL — the analyst console does not exist.

- [ ] **Step 3: Implement the console**

Create `support.tsx` (a client component) that loads the queue, renders filter buttons ("Todas", "Para você", "Minhas"), lists conversations with employee name and a tag derived from `handoff?.reason` ("Transferida", "Incidente crítico", "Chamado vencido", "Sem segurança"), and on selection loads the detail into a thread plus a "Chamados de {name}" panel (title + status/priority per ticket). Show a takeover bar: while unassigned, "Assumir atendimento" and a locked composer ("Assuma o atendimento para responder"); while owned, "Devolver ao agent" and "Encerrar atendimento" and an enabled composer that calls `reply`. Use Brazilian-Portuguese labels and keyboard-visible controls.

- [ ] **Step 4: Wire the console into the analyst view**

In `history.tsx`, replace the analyst placeholder with `<Support user={user} onLogout={onLogout} />` when `user.role === 'analyst'`.

- [ ] **Step 5: Run the browser workflow to verify it passes**

Run: `npm run build && npm run test:e2e`

Expected: PASS — the analyst flow is usable end to end.

- [ ] **Step 6: Commit Task 5**

```bash
git add apps/web/src/features/support apps/web/src/features/history apps/web/src/app/globals.css apps/web/e2e
git commit -m "feat: add analyst console"
```

### Task 6: Evidence and project status

**Files:**
- Create: `docs/human-support-verification.md`
- Modify: `docs/challenge-acceptance.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/challenge-context.md`

- [ ] **Step 1: Record the verification evidence**

Create `docs/human-support-verification.md` with the commit list, the commands run, and B11 plus the analyst portions of B10/B13/B15 evidence; disclose that V04/V05 visual fidelity remains issue #9 and that live-model reliability remains #10.

- [ ] **Step 2: Update the acceptance, roadmap, and context docs**

Mark B11 and the analyst portions of B10/B13 as demonstrated; update the roadmap table for #8 to note the analyst console is delivered and #8 can close once the owner confirms; keep V04/V05 in #9.

- [ ] **Step 3: Run delivery verification**

Run: `npm run format && npm run check`

Expected: PASS. Run `npm run smoke:model` separately only if a local provider key is configured; otherwise record the skip.

- [ ] **Step 4: Commit Task 6**

```bash
git add docs
git commit -m "docs: record analyst console verification"
```

## Plan self-review

- **Spec coverage:** Tasks 1–3 cover the data model, states, authorization, atomicity, and all B11/B10/B13/B15 behavior. Task 4 covers the employee side. Task 5 covers the console UI and V04/V05 functional layout. Task 6 records evidence and updates docs.
- **Step scan:** Every implementation task starts RED, runs the named focused check, makes the smallest change, then runs GREEN and commits.
- **Type consistency:** `ConversationState`/`MessageView`/`SupportConversationSummary`/`toMessageView` are produced in Task 1 and consumed by Tasks 2–4; `queue`/`detail` are produced in Task 2 and consumed by Task 3.
- **Review Focus:** each of the five failure modes is pinned to Task 2, Task 3, or Task 4 tests.
- **Proportion:** the plan specifies interfaces, signatures, and test assertions, not implementation bodies.
