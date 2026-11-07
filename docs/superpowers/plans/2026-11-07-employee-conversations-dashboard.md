# Employee Conversations Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent employee chat actions and a read-only dashboard for the employee's tickets and conversation history.

**Architecture:** Extend the employee-owned conversation list with an authorized server-computed summary, then render it with existing ticket data in a new web dashboard component. Keep page selection and conversation creation in the existing `History` shell so chat state, human pauses, and authorization remain centralized.

**Tech Stack:** TypeScript, NestJS, Prisma/SQLite, Zod contracts, React/Next.js, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-07-employee-conversations-dashboard-design.md`

## Global Constraints

- Issue #64 branch: `feature/LAB-0064`; do not merge without explicit owner instruction.
- Use strict TypeScript and shared Zod wire contracts.
- Keep ticket/conversation authorization and database reads in the backend.
- User-facing copy is Brazilian Portuguese; engineering artifacts are English.
- Do not disclose model credentials or claim original-reference visual verification.
- `Nova conversa` must not bypass an employee conversation paused for human support.

## Review Focus

- An employee must never receive summaries, context ticket numbers, or ticket cards owned by another employee; cover in API integration tests.
- A conversation without messages or without an associated ticket must render an honest fallback rather than throw; cover contract and browser tests.
- A human-paused conversation must disable permanent new-chat creation as well as existing in-chat paths; cover browser behavior.
- Selecting a historical conversation must load its messages before the dashboard disappears; cover browser request/order behavior.
- At 375 px wide, top-bar actions and dashboard rows must remain within the viewport; cover a Chromium overflow assertion.

---

### Task 1: Add authorized conversation summaries

**Files:**
- Modify: `packages/contracts/src/conversation.ts`
- Modify: `packages/contracts/src/conversation.test.ts`
- Modify: `apps/api/src/conversations/conversations.service.ts`
- Modify: `apps/api/test/conversations.integration.test.ts`

**Interfaces:**
- Produces `ConversationView.latestMessage` as `{ content, createdAt, role } | null`.
- Produces `ConversationView.contextTicketNumber` as `string | null`.
- `ConversationsService.list(user)` loads these values only from conversations owned by `user`.

- [ ] **Step 1: Write failing contract and integration tests**

Add contract cases for a nullable latest message and nullable context-ticket
number. Add an integration case that creates owned and foreign conversations,
associates a ticket with the owned conversation, and expects only the owned
summary with its own latest message and public ticket number.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npm test -- packages/contracts/src/conversation.test.ts` and `npm run test:integration -- apps/api/test/conversations.integration.test.ts`

Expected: FAIL because the existing strict conversation contract and list query
do not provide the summary fields.

- [ ] **Step 3: Extend the contract and `ConversationsService.list`**

Make the two fields required-but-nullable in `ConversationViewSchema`. Fetch the
latest message and associated ticket number in the employee-scoped list query,
then parse them in `conversationView` without changing detail-message access.

- [ ] **Step 4: Run targeted tests to verify they pass**

Run: `npm test -- packages/contracts/src/conversation.test.ts` and `npm run test:integration -- apps/api/test/conversations.integration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the contract increment**

```bash
git add packages/contracts/src/conversation.ts packages/contracts/src/conversation.test.ts apps/api/src/conversations/conversations.service.ts apps/api/test/conversations.integration.test.ts
git commit -m "feat: summarize employee conversations"
```

### Task 2: Render the employee conversations dashboard

**Files:**
- Create: `apps/web/src/features/history/conversations-dashboard.tsx`
- Modify: `apps/web/src/features/history/history.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/e2e/identity-history.spec.ts`
- Modify: `apps/web/e2e/profile.spec.ts`

**Interfaces:**
- Consumes `ConversationView[]`, `TicketView[]`, `onChooseConversation(id)`, and `onReturnToSupport()`.
- Produces a labelled read-only dashboard with ticket cards and selectable
  conversation rows.

- [ ] **Step 1: Write failing browser tests**

Add a test that sees `Minhas conversas` and `Nova conversa` in the employee
top bar, opens the dashboard, sees owned ticket/conversation summaries, selects
a row, and returns to that conversation's chat. Add a paused-conversation case
where `Nova conversa` is disabled. Add a 375 px overflow assertion.

- [ ] **Step 2: Run the targeted browser tests to verify they fail**

Run: `npm run test:e2e -- apps/web/e2e/identity-history.spec.ts apps/web/e2e/profile.spec.ts`

Expected: FAIL because neither permanent actions nor the dashboard exist.

- [ ] **Step 3: Implement the dashboard and shell navigation**

Create `ConversationsDashboard` with read-only ticket cards and conversation
rows. In `History`, fetch the existing authorized ticket list when opening the
dashboard; wire `Minhas conversas` to the new page, wire selection through the
existing `choose` callback, and render permanent `Nova conversa` with the
human-pause guard. Keep the sidebar `Atendimento` as the only return action.

- [ ] **Step 4: Add scoped responsive styles**

Style the top-bar action group, centered dashboard column, ticket cards, and
conversation state badges to follow the owner-provided screenshots without
changing analyst-console styles.

- [ ] **Step 5: Run targeted browser tests to verify they pass**

Run: `npm run test:e2e -- apps/web/e2e/identity-history.spec.ts apps/web/e2e/profile.spec.ts`

Expected: PASS with isolated database and ports.

- [ ] **Step 6: Commit the UI increment**

```bash
git add apps/web/src/features/history/conversations-dashboard.tsx apps/web/src/features/history/history.tsx apps/web/src/app/globals.css apps/web/e2e/identity-history.spec.ts apps/web/e2e/profile.spec.ts
git commit -m "feat: add employee conversations dashboard"
```

### Task 3: Record evidence and run the delivery gate

**Files:**
- Modify: `docs/challenge-context.md`
- Modify: `docs/challenge-acceptance.md`

**Interfaces:**
- Consumes executed command results and reviewed captures.
- Produces an accurate #64 evidence entry that distinguishes owner screenshots
  from unavailable private original references.

- [ ] **Step 1: Run formatting and the full verification gate**

Run: `npm run format`, then `npm run check`.

Expected: all typecheck, lint, format, unit, integration, build, and isolated
Chromium checks pass.

- [ ] **Step 2: Inspect the desktop and 375 px dashboard states manually**

Verify the top-bar actions, dashboard hierarchy, conversation selection, disabled
paused-state creation, and absence of `Falar com o Nexo Assist`. Record only
observed results.

- [ ] **Step 3: Update acceptance evidence**

Record the exact revision, commands, browser coverage, owner-supplied screenshot
provenance, and any remaining visual gaps. Do not claim native Pencil comparison.

- [ ] **Step 4: Commit evidence**

```bash
git add docs/challenge-context.md docs/challenge-acceptance.md
git commit -m "docs: record conversations dashboard evidence"
```
