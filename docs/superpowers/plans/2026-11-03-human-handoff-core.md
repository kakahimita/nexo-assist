# Human Handoff Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a durable employee-to-human handoff that suppresses stale agent output and remains safe across restart.

**Architecture:** Persist the conversation lifecycle and its version in Prisma; expose server-owned handoff operations through strict contracts. Consultation captures a lifecycle version and conditionally writes its terminal result, so a concurrent handoff wins. The first increment supplies the employee waiting experience; analyst ownership and console functionality remain a linked delivery.

**Tech Stack:** TypeScript, NestJS, Prisma 7 with SQLite, Zod, Vitest, Next.js.

**Spec:** `docs/superpowers/specs/2026-11-03-human-handoff-core-design.md`

## Global Constraints

- Authenticated identity comes only from `IdentityGuard`; request bodies and model events never provide an employee or analyst ID.
- State values are exactly `agent` and `waiting_for_analyst` in this increment; elapsed time and new conversations never clear waiting state.
- A state transition increments `stateVersion` atomically; an agent terminal write must require both `agent` and the captured version.
- The handoff summary uses persisted messages/tickets and a deterministic server formatter; model prose cannot become queue metadata.
- Existing drafts, ticket confirmation, session-limit counting, privacy boundaries, and failed-agent-result honesty must remain intact.
- Tests use isolated temporary SQLite databases. UI copy is Brazilian Portuguese; code, contracts, commits, and engineering docs are English.

## Review Focus

- A consultation that has emitted partial SSE text before handoff must not persist or later reload an agent answer (Task 2).
- A failed provider run after handoff must not append its generic failed agent message (Task 2).
- A waiting employee may add a message at the session cap boundary; it must count once and never call the model (Task 2).
- A foreign employee or analyst must not read, transition, or use a waiting employee conversation as a messaging side channel (Tasks 1–2).
- A restart and an additional new employee conversation must not resume the original waiting conversation (Task 1).

---

### Task 1: Durable handoff lifecycle and authenticated API

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_conversation_handoff/migration.sql`
- Modify: `packages/contracts/src/conversation.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/conversations/conversations.service.ts`
- Modify: `apps/api/src/conversations/conversations.controller.ts`
- Create: `apps/api/src/conversations/handoff-summary.ts`
- Create: `apps/api/test/handoff.integration.test.ts`

**Interfaces:**
- Consumes: current employee-scoped `Conversation`, `Message`, and `Ticket` rows.
- Produces: `ConversationView` with `state`, `stateVersion`, and nullable `handoff`; `HandoffView`; `ConversationsService.requestHandoff(user, conversationId, reason)`; `ConversationsService.captureAgentRun(user, conversationId)`; and `ConversationsService.appendAgentTurnIfCurrent(...)` for Task 2.

- [ ] **Step 1: Write failing contract tests for the lifecycle wire types**

In `packages/contracts/src/conversation.test.ts`, parse a waiting conversation with `{ reason: 'employee_request', summary: '...', requestedAt: ISO_DATE }`, reject an unknown state/reason and client-provided summary, and preserve the existing active conversation/message cases.

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `npm test -- packages/contracts/src/conversation.test.ts`

Expected: FAIL because the lifecycle schemas and types do not exist.

- [ ] **Step 3: Add strict lifecycle contracts**

In `packages/contracts/src/conversation.ts`, define/export `ConversationStateSchema`, `HandoffReasonSchema`, `HandoffViewSchema`, a `ConversationViewSchema` that includes lifecycle fields, and `RequestHandoffInputSchema` accepting only `{ reason }`. Re-export them from `packages/contracts/src/index.ts`. Do not accept a summary, user ID, analyst ID, or state version from a client.

- [ ] **Step 4: Run the contract test to verify it passes**

Run: `npm test -- packages/contracts/src/conversation.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing integration tests for durable, private handoff**

In `apps/api/test/handoff.integration.test.ts`, create Ana's conversation and persisted messages/tickets, POST `/api/conversations/:id/handoff` as Ana, and assert `201` returns `waiting_for_analyst`, version `1`, server-derived summary, and `employee_request`. Assert a second request is `409`; Bruno gets `404`; an analyst gets `403`; forged `summary`, `state`, or identity fields get `400`. Close/recreate the app with the same database and assert waiting state remains after Ana creates another conversation.

- [ ] **Step 6: Run the handoff integration test to verify it fails**

Run: `npm run test:integration -- apps/api/test/handoff.integration.test.ts`

Expected: FAIL because no lifecycle database fields or handoff endpoint exist.

- [ ] **Step 7: Implement the migration and lifecycle service**

Add `Conversation.state` defaulting to `agent`, `stateVersion` defaulting to `0`, and nullable `handoffReason`, `handoffSummary`, and `handoffRequestedAt`; create and apply a committed Prisma migration. Implement the summary formatter in `handoff-summary.ts` from bounded persisted message/ticket facts. In one transaction, verify employee ownership and `agent` state, write the server summary/reason/time, and increment the version with a conditional `updateMany`; map zero updated rows to `ConflictException`. Return validated contract views.

- [ ] **Step 8: Implement the employee endpoint and read views**

Add `POST /api/conversations/:id/handoff`, validate only `RequestHandoffInputSchema`, and add lifecycle fields to list/create/read views. Keep employee authorization in the service; do not expose the handoff operation to analysts yet.

- [ ] **Step 9: Run focused integration and unit tests to verify they pass**

Run: `npm test -- packages/contracts/src/conversation.test.ts && npm run test:integration -- apps/api/test/handoff.integration.test.ts`

Expected: PASS; restart, private-access, strict-input, conflict, and summary assertions are all green.

- [ ] **Step 10: Commit Task 1**

```bash
git add apps/api/prisma apps/api/src/conversations apps/api/test/handoff.integration.test.ts packages/contracts/src
git commit -m "feat: persist safe conversation handoff"
```

### Task 2: Guard consultation runs and connect verified handoff triggers

**Files:**
- Modify: `apps/api/src/conversations/conversations.service.ts`
- Modify: `apps/api/src/consultation/consultation.service.ts`
- Modify: `apps/api/src/consultation/consultation.controller.ts`
- Modify: `apps/api/src/agent/consultation/types.ts`
- Modify: `apps/api/src/agent/consultation/fixture-consultation.ts`
- Modify: `apps/api/src/agent/consultation/mastra-consultation.ts`
- Modify: `apps/api/src/agent/consultation/turn.ts`
- Modify: `apps/api/src/agent/consultation/quick-replies.ts`
- Modify: `apps/api/test/handoff.integration.test.ts`
- Modify: `apps/api/test/consultation-stream.integration.test.ts`

**Interfaces:**
- Consumes: Task 1's `captureAgentRun` and conditional `appendAgentTurnIfCurrent` lifecycle API.
- Produces: a `handoff` consultation engine event with a validated `HandoffReason`, an SSE `handoff-waiting` terminal event, and a stream endpoint that persists employee input without invoking the engine while waiting.

- [ ] **Step 1: Write failing stream tests for pause and stale output**

Extend `apps/api/test/consultation-stream.integration.test.ts` with a controllable engine that yields one text delta, waits, and then yields a completed answer. Start its request, POST the employee handoff endpoint, release the engine, then assert the database/history contains no late agent message and the stream's terminal state is `handoff-waiting`. Add a matching provider-error case proving no generic failed agent message is appended after handoff.

- [ ] **Step 2: Run the stale-output tests to verify they fail**

Run: `npm run test:integration -- apps/api/test/consultation-stream.integration.test.ts`

Expected: FAIL because the current final/error paths append an agent message unconditionally.

- [ ] **Step 3: Write failing trigger and waiting-message tests**

In `apps/api/test/handoff.integration.test.ts`, assert one handoff each for an employee request, a critical draft proposal, an overdue selected ticket, and an explicitly unresolved low-confidence decision. For each, assert a server-derived reason/summary and no agent reply afterward. Assert an employee message sent while waiting persists and counts toward the existing limit, yields `handoff-waiting`, and the injected engine receives no call.

- [ ] **Step 4: Run the trigger tests to verify they fail**

Run: `npm run test:integration -- apps/api/test/handoff.integration.test.ts`

Expected: FAIL because engines/tool results cannot request a durable handoff and waiting streams still run the engine.

- [ ] **Step 5: Add conditional run capture and terminal persistence**

Add `captureAgentRun` to read an employee-owned conversation's current version only when state is `agent`. Make `appendAgentTurnIfCurrent` run in a transaction and condition its create on an `updateMany` lifecycle guard; return `null` on a state/version mismatch. Use it for both completed and failed turns. `ConsultationService.run` must discard a stale terminal result, emit `handoff-waiting`, and never turn it into a false failed answer.

- [ ] **Step 6: Add server-validated engine handoff events**

Extend `ConsultationEngineEvent` and `ConsultationTurn` with a handoff event containing one `HandoffReason`. Map it from deterministic critical/overdue/uncertain paths and from a strict live structured decision; the service, not either engine, invokes Task 1's lifecycle transition. Update quick replies so supported human-support wording maps to the explicit employee handoff endpoint and never advertises an unavailable action.

- [ ] **Step 7: Make waiting streams agent-silent**

After appending an employee message, `ConsultationController` must inspect lifecycle state. If waiting, return an SSE `user-message` plus `handoff-waiting` event without calling `ConsultationService.run`; preserve the existing `409 session_limit` behavior before SSE headers. Extend contracts/SSE parsing for the event.

- [ ] **Step 8: Run focused tests to verify they pass**

Run: `npm run test:integration -- apps/api/test/handoff.integration.test.ts apps/api/test/consultation-stream.integration.test.ts && npm test -- apps/api/src/agent/consultation/turn.test.ts`

Expected: PASS; all four triggers, stale completion/error, waiting silence, cap, and decision parsing assertions are green.

- [ ] **Step 9: Commit Task 2**

```bash
git add apps/api/src apps/api/test packages/contracts/src
git commit -m "feat: pause agent during human handoff"
```

### Task 3: Employee waiting experience and delivery evidence

**Files:**
- Modify: `apps/web/src/features/history/history.tsx`
- Modify: `apps/web/src/features/consultation/consultation.tsx`
- Modify: `apps/web/src/features/consultation/stream.ts`
- Modify: `apps/web/src/features/consultation/stream.test.ts`
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/e2e/handoff.spec.ts`
- Create: `docs/handoff-verification.md`
- Modify: `docs/challenge-context.md`
- Modify: `docs/challenge-acceptance.md`
- Modify: `docs/roadmap.md`

**Interfaces:**
- Consumes: Task 1 conversation lifecycle views and Task 2 `handoff-waiting` SSE event.
- Produces: an employee handoff control and waiting panel that reports persisted state and permits messages without showing agent output.

- [ ] **Step 1: Write failing client stream and component tests**

In `stream.test.ts`, parse `handoff-waiting` and expose the lifecycle state to the consultation component. Add a focused component test proving a waiting conversation renders the persisted reason/summary and calls the handoff endpoint with only `{ reason: 'employee_request' }`; it must not render an agent-send expectation after the SSE waiting event.

- [ ] **Step 2: Run the focused web tests to verify they fail**

Run: `npm test -- apps/web/src/features/consultation/stream.test.ts`

Expected: FAIL because the waiting event, handoff action, and panel do not exist.

- [ ] **Step 3: Implement the accessible waiting flow**

Render Brazilian-Portuguese status, reason, and server summary in `consultation.tsx`; add a clearly labelled “Falar com analista” control and pending/error states. Keep the composer enabled while waiting, but treat `handoff-waiting` as a terminal no-agent response. Update history state loading and styles with keyboard-visible controls and narrow-screen layout; do not recreate the deferred analyst frames.

- [ ] **Step 4: Run focused web tests to verify they pass**

Run: `npm test -- apps/web/src/features/consultation/stream.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing browser workflow**

In `apps/web/e2e/handoff.spec.ts`, log in as Ana, request human support, assert the waiting panel and a later employee message appear without an agent answer, then restart the app harness and assert the same conversation is still waiting. Use the fixture provider and isolated test database.

- [ ] **Step 6: Run the browser workflow to verify it fails**

Run: `npm run build && npm run test:e2e`

Expected: FAIL before the UI/API integration is complete.

- [ ] **Step 7: Run the browser workflow to verify it passes**

Run: `npm run build && npm run test:e2e`

Expected: PASS; the employee flow is usable and persists across restart.

- [ ] **Step 8: Record bounded evidence and update project status**

Create `docs/handoff-verification.md` with commit, commands, B09/B10/B13/B14/B15/B16 evidence, skipped live-model checks, and the explicit deferred analyst-console scope. Update challenge context, acceptance, and roadmap only for checks actually demonstrated. Keep B11 and V04/V05 incomplete and state that a linked issue is required before the console branch.

- [ ] **Step 9: Run delivery verification**

Run: `npm run format && npm run check`

Expected: PASS. Then run `npm run smoke:model` separately only if a configured local provider key is available; record its actual result or skip reason without treating fixtures as live evidence.

- [ ] **Step 10: Commit Task 3**

```bash
git add apps/web docs
git commit -m "feat: show employee handoff waiting state"
```

## Plan self-review

- **Spec coverage:** Tasks 1–2 cover durable state, all B09 triggers, pause, stale rejection, restart, agent silence, privacy, cap, and model-failure continuity. Task 3 covers the minimum employee UI and evidence. The analyst console is intentionally outside this approved first increment.
- **Step scan:** Every implementation task starts RED, runs the named focused check, makes the smallest implementation, then runs GREEN and commits. No step relies on an unspecified identity, summary, or concurrency behavior.
- **Type consistency:** `ConversationState`, `HandoffReason`, `HandoffView`, `captureAgentRun`, and `appendAgentTurnIfCurrent` are produced in Task 1 and consumed by Task 2; `handoff-waiting` is produced in Task 2 and consumed in Task 3.
- **Review focus:** The five high-risk conditions listed above are each assigned to Task 1 or Task 2 tests.
- **Proportion:** The plan specifies interfaces and expected proofs, not implementation bodies; migration naming is intentionally timestamped at execution.
