# Ticket Number and Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every ticket a server-generated `INC-…`/`REQ-…` number and one of five real statuses, and render the V03 consultation answer as a structured card.

**Architecture:** Contracts carry the shared vocabulary (status enum, formatted number string, close input). Prisma stores the integer number and the conversation-to-ticket link; two pure helpers in `apps/api/src/tickets` allocate numbers and apply status transitions. Conversation handoff/claim/close drive those transitions inside their existing transactions, and never fail because of ticket state. The web renders what the server sends.

**Tech Stack:** npm workspaces, strict TypeScript, Zod contracts, NestJS, Prisma/SQLite, Next.js/React, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-ticket-number-status-design.md`

## Global Constraints

- Issue #49, delivering on `feature/LAB-0046` (PR #47); never commit to `main`.
- Business rules, authorization and database access stay in the backend; identity comes from the server session.
- No new dependencies, no paid fallback, no secrets/databases/original challenge files committed.
- Engineering artifacts in English; user-visible copy in Brazilian Portuguese.
- Integration and browser checks use isolated temporary databases; never point tests at `data/nexo.db`.
- Ticket status never blocks claim, return, close or handoff; an invalid transition is a no-op with no event.
- Serialize numbers per type; formatting is `TYPE-` plus five digits and happens on the server.
- Expected results come from the PRD, the spec's convention table and the acceptance matrix, not from current behavior.

## Review Focus

1. A legacy conversation or stored decision without a ticket number still loads and renders without a number (no validation crash).
2. Closing a `REQ` without an outcome, or an `INC` with an outcome, is rejected with 400 and leaves both conversation and ticket unchanged.
3. Repeating claim/return/close, or acting on a terminal ticket, does not 500 or duplicate `status_changed` events.
4. Reopening at exactly seven elapsed days succeeds; one millisecond later fails.
5. Long titles and descriptions at 375 px wrap without horizontal overflow.

---

### Task 1: Contracts vocabulary

**Files:**
- Modify: `packages/contracts/src/ticket.ts`
- Modify: `packages/contracts/src/consultation.ts`
- Modify: `packages/contracts/src/support.ts`
- Test: `packages/contracts/src/ticket.test.ts`, `packages/contracts/src/consultation.test.ts`, `packages/contracts/src/support.test.ts`

**Interfaces:**
- Produces: `TicketStatusSchema`, `TicketStatus`, `ticketStatusLabel(status: TicketStatus): string`.
- Produces: `TicketView.number: string | null`, `ConsultationTicketView.number: string | null`, `ConsultationTicketView.description: string | null`, both `status: TicketStatus`.
- Produces: `TicketEventView.kind` includes `'status_changed'`.
- Produces: `SupportCloseInputSchema` (`{ outcome?: 'approved' | 'resolved' }`), type
  `SupportCloseInput`, and `SupportConversationSummary.contextTicketId: string | null`.

- [ ] **Step 1: Write the failing contract tests**

```ts
// packages/contracts/src/ticket.test.ts
it('accepts the five ticket statuses and rejects the old vocabulary', () => {
  for (const status of ['open', 'waiting_for_analyst', 'in_progress', 'approved', 'resolved'])
    expect(TicketStatusSchema.parse(status)).toBe(status);
  expect(TicketStatusSchema.safeParse('waiting').success).toBe(false);
});
it('labels every status in Brazilian Portuguese', () => {
  expect(ticketStatusLabel('waiting_for_analyst')).toBe('Aguardando analista');
  expect(ticketStatusLabel('in_progress')).toBe('Em andamento');
  expect(ticketStatusLabel('approved')).toBe('Aprovado');
});
it('keeps legacy tickets without a number valid', () => {
  expect(TicketViewSchema.parse({ ...ticket, number: undefined }).number).toBeNull();
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run --project unit packages/contracts/src/ticket.test.ts`
Expected: FAIL (`TicketStatusSchema` is not exported / label is not a function).

- [ ] **Step 3: Implement the vocabulary**

In `packages/contracts/src/ticket.ts`:

```ts
export const TicketStatusSchema = z.enum([
  'open',
  'waiting_for_analyst',
  'in_progress',
  'approved',
  'resolved',
]);
export type TicketStatus = z.infer<typeof TicketStatusSchema>;
const statusLabels: Record<TicketStatus, string> = {
  open: 'Aberto',
  waiting_for_analyst: 'Aguardando analista',
  in_progress: 'Em andamento',
  approved: 'Aprovado',
  resolved: 'Resolvido',
};
export function ticketStatusLabel(status: TicketStatus): string {
  return statusLabels[status];
}
```

Use `number: z.string().nullable().default(null)` in `TicketViewSchema` and `status: TicketStatusSchema`.
In `consultation.ts` add `number`, `description: z.string().nullable().default(null)` and the shared status schema.
In `support.ts` add `SupportCloseInputSchema` and `contextTicketId: z.string().nullable()` to the summary.
Add `'status_changed'` to `TicketEventViewSchema.kind`.

- [ ] **Step 4: Run the contract tests**

Run: `npx vitest run --project unit packages/contracts/src`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src
git commit -m "feat(contracts): add ticket statuses, numbers and close input"
```

---

### Task 2: Database schema, migration and seed numbers

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261105150000_ticket_number_and_status/migration.sql`
- Modify: `apps/api/src/tickets/fixtures.ts`
- Test: `apps/api/test/ticket-number-migration.integration.test.ts`

**Interfaces:**
- Produces table `TicketNumberSequence(type TEXT PRIMARY KEY, value INTEGER NOT NULL)`.
- Produces `Ticket.number INTEGER` with unique `(type, number)`, and `Conversation.contextTicketId TEXT`.
- Seed numbers: `fixture-ana-open` → `INC-20311`, `fixture-ana-resolved` → `INC-20150`, `fixture-bruno-open` → `REQ-10442`.

- [ ] **Step 1: Write the failing migration test**

Follow `apps/api/test/conversational-draft-migration.integration.test.ts`: apply every migration up to and including `20261103191858_add_analyst_ownership` to a temp `node:sqlite` database, insert a user and three tickets without numbers (two `INC`, one `REQ`, distinct `createdAt`), then apply the new migration and assert:

```ts
expect(db.prepare('SELECT number, status FROM Ticket ORDER BY createdAt').all()).toEqual([
  { number: 20000, status: 'open' },
  { number: 20001, status: 'open' },
  { number: 10000, status: 'open' },
]);
expect(db.prepare('SELECT type, value FROM TicketNumberSequence ORDER BY type').all()).toEqual([
  { type: 'INC', value: 20001 },
  { type: 'REQ', value: 10000 },
]);
expect(() =>
  db.exec(`INSERT INTO Ticket (id, ownerId, title, normalizedTitle, description, type, category, priority, impact, slaStartedAt, number) VALUES ('dup','u','t','t','d','INC','hardware','low','self',CURRENT_TIMESTAMP,20000)`),
).toThrow();
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run --project integration apps/api/test/ticket-number-migration.integration.test.ts`
Expected: FAIL (`no such table: TicketNumberSequence` / `no such column: number`).

- [ ] **Step 3: Update the Prisma schema**

```prisma
model Ticket {
  number Int?
  // existing fields
  @@unique([type, number])
  contextConversations Conversation[] @relation("ConversationContextTicket")
}
model TicketNumberSequence {
  type  String @id
  value Int
}
model Conversation {
  contextTicketId String?
  contextTicket   Ticket? @relation("ConversationContextTicket", fields: [contextTicketId], references: [id], onDelete: SetNull)
}
```

- [ ] **Step 4: Create and edit the migration**

Run: `npm run db:migrate:dev --workspace @nexo/api -- --create-only --name ticket_number_and_status`
Then edit the generated SQL so it backfills before adding the unique index and sequence rows:

```sql
UPDATE "Ticket" SET "number" = (
  SELECT base + rn - 1 FROM (
    SELECT id,
      CASE type WHEN 'INC' THEN 20000 ELSE 10000 END + ROW_NUMBER() OVER (PARTITION BY type ORDER BY createdAt, id) - 1 AS base
    FROM "Ticket"
  ) ranked WHERE ranked.id = "Ticket"."id"
);
CREATE UNIQUE INDEX "Ticket_type_number_key" ON "Ticket"("type", "number");
INSERT INTO "TicketNumberSequence" ("type", "value") SELECT "type", MAX("number") FROM "Ticket" GROUP BY "type";
```

Keep the generated `Conversation` table rebuild so `contextTicketId` keeps its foreign key.

- [ ] **Step 5: Assign seed numbers**

In `apps/api/src/tickets/fixtures.ts` add `number` to each fixture create block using the mapping in Interfaces; leave `update: {}` so an existing number is never overwritten. Initialize `TicketNumberSequence` after fixtures with the current maximum per type.

- [ ] **Step 6: Run the migration test and the database suite**

Run: `npx vitest run --project integration apps/api/test/ticket-number-migration.integration.test.ts apps/api/test/database.integration.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma apps/api/src/tickets/fixtures.ts apps/api/test/ticket-number-migration.integration.test.ts
git commit -m "feat(api): persist ticket numbers and conversation ticket link"
```

---

### Task 3: Number allocation and view mapping

**Files:**
- Create: `apps/api/src/tickets/ticket-number.ts`
- Modify: `apps/api/src/tickets/prisma-ticket-service.ts`
- Modify: `apps/api/src/agent/tools/consultation-tools.ts`
- Test: `apps/api/test/ticket-numbers.integration.test.ts`

**Interfaces:**
- Produces: `allocateTicketNumber(tx: Prisma.TransactionClient, type: 'INC' | 'REQ'): Promise<number>` (first value 20000 for INC, 10000 for REQ).
- Produces: `formatTicketNumber(type: 'INC' | 'REQ', number: number): string`.
- `PrismaTicketService.view` maps `number: ticket.number === null ? null : formatTicketNumber(ticket.type, ticket.number)`.

- [ ] **Step 1: Write the failing integration test**

```ts
it('allocates sequential numbers per type and exposes them formatted', async () => {
  const [first, second] = await createConfirmedTickets(['INC', 'INC']);
  expect(first.number).toBe('INC-20000');
  expect(second.number).toBe('INC-20001');
  expect((await createConfirmedTickets(['REQ']))[0]!.number).toBe('REQ-10000');
});
it('matches a consultation reference by formatted number', async () => {
  const [ticket] = await createConfirmedTickets(['INC']);
  const result = await tool.execute({ query: ticket.number, kind: 'reference' });
  expect(result.match).toBe('one');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run --project integration apps/api/test/ticket-numbers.integration.test.ts`
Expected: FAIL (`number` is null).

- [ ] **Step 3: Implement allocation and mapping**

```ts
export const TICKET_NUMBER_START = { INC: 20000, REQ: 10000 } as const;
export function formatTicketNumber(type: 'INC' | 'REQ', number: number): string {
  return `${type}-${String(number).padStart(5, '0')}`;
}
export async function allocateTicketNumber(tx: Prisma.TransactionClient, type: 'INC' | 'REQ') {
  const row = await tx.ticketNumberSequence.upsert({
    where: { type },
    create: { type, value: TICKET_NUMBER_START[type] },
    update: { value: { increment: 1 } },
  });
  return row.value;
}
```

Call it in the create branch of `confirm()` and pass `number` to `tx.ticket.create`. Map the formatted string in `view()`; add `number` and `description` to the consultation-tool projection; compare `normalize(ticket.number)` in reference matching.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project integration apps/api/test/ticket-numbers.integration.test.ts apps/api/test/consultation-tools.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/tickets/ticket-number.ts apps/api/src/tickets/prisma-ticket-service.ts apps/api/src/agent/tools/consultation-tools.ts apps/api/test/ticket-numbers.integration.test.ts
git commit -m "feat(api): allocate formatted ticket numbers"
```

---

### Task 4: Status predicates and ticket writes

**Files:**
- Modify: `apps/api/src/tickets/rules.ts`
- Modify: `apps/api/src/tickets/prisma-ticket-service.ts`
- Test: `apps/api/src/tickets/rules.test.ts`, `apps/api/test/ticket-confirmation.integration.test.ts`

**Interfaces:**
- Produces: `isActiveStatus(status: TicketStatus): boolean`, `canSupplement(status)`, `canTransfer(status, transferRequested)`, `canReopen(status, terminalAt, now)`.
- Produces: `terminalTimestamp(status): boolean` for `approved`/`resolved`.

- [ ] **Step 1: Write the failing rule tests**

```ts
it('treats waiting and in-progress tickets as active', () => {
  expect(isActiveStatus('waiting_for_analyst')).toBe(true);
  expect(isActiveStatus('in_progress')).toBe(true);
  expect(isActiveStatus('approved')).toBe(false);
});
it('reopens exactly at the seven-day boundary', () => {
  const terminal = new Date('2026-11-01T12:00:00Z');
  expect(canReopen('resolved', terminal, new Date('2026-11-08T12:00:00Z'))).toBe(true);
  expect(canReopen('approved', terminal, new Date('2026-11-08T12:00:00.001Z'))).toBe(false);
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run --project unit apps/api/src/tickets/rules.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement predicates and use them**

Update `rules.test.ts` expectations for the new `canReopen` signature. In `PrismaTicketService.confirm`: duplicate detection uses `status: { in: ['open', 'waiting_for_analyst', 'in_progress'] }`, supplement requires `canSupplement`, transfer requires `canTransfer`, reopen requires `canReopen(status, resolvedAt, now)` and clears `transferRequested`. Compute `overdue` only for active statuses in `view()`.

- [ ] **Step 4: Run the rule and confirmation suites**

Run: `npx vitest run --project unit apps/api/src/tickets/rules.test.ts && npx vitest run --project integration apps/api/test/ticket-confirmation.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/tickets/rules.ts apps/api/src/tickets/rules.test.ts apps/api/src/tickets/prisma-ticket-service.ts apps/api/test/ticket-confirmation.integration.test.ts
git commit -m "feat(api): drive ticket writes by active status rules"
```

---

### Task 5: Conversation ticket link and support transitions

**Files:**
- Create: `apps/api/src/tickets/status-transition.ts`
- Modify: `apps/api/src/conversations/conversations.service.ts`
- Modify: `apps/api/src/consultation/consultation.service.ts`
- Modify: `apps/api/src/human-support/human-support.service.ts`
- Modify: `apps/api/src/human-support/human-support.controller.ts`
- Test: `apps/api/test/handoff.integration.test.ts`, `apps/api/test/support.integration.test.ts`

**Interfaces:**
- Produces: `transitionTicket(tx, ticketId, next: TicketStatus, now: Date): Promise<boolean>` — no-op for the current or a terminal ticket; otherwise updates status/resolvedAt and writes a `status_changed` event with `Aberto → Aguardando analista` content.
- Changes: `ConversationsService.requestHandoff(user, conversationId, reason, contextTicketId: string | null = null)`.
- Changes: `HumanSupportService.close(user, conversationId, input: SupportCloseInput)`.

- [ ] **Step 1: Write the failing transition tests**

```ts
it('moves the linked ticket through handoff, claim and close', async () => {
  await requestHandoff(employee, conversationId, 'employee_request');
  expect(await ticketStatus(ticketId)).toBe('waiting_for_analyst');
  await support.claim(analyst, conversationId);
  expect(await ticketStatus(ticketId)).toBe('in_progress');
  await support.returnToAgent(analyst, conversationId);
  expect(await ticketStatus(ticketId)).toBe('in_progress');
  await support.close(analyst, conversationId, { outcome: 'resolved' });
  expect(await ticketStatus(ticketId)).toBe('resolved');
});
it('requires an outcome for a request and rejects one for an incident', async () => {
  await expect(support.close(analyst, reqConversation, {})).rejects.toThrow(BadRequestException);
  await expect(support.close(analyst, incConversation, { outcome: 'approved' })).rejects.toThrow(BadRequestException);
});
it('closes the conversation even when the ticket is already terminal', async () => {
  await support.close(analyst, conversationId, { outcome: 'resolved' });
  await expect(support.close(analyst, conversationId, {})).resolves.toBeDefined();
  expect(await statusChangedEvents(ticketId)).toHaveLength(1);
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx vitest run --project integration apps/api/test/handoff.integration.test.ts apps/api/test/support.integration.test.ts`
Expected: FAIL (status stays `open`; close signature mismatch).

- [ ] **Step 3: Implement the transitions**

In `requestHandoff`, resolve the link in this order: explicit `contextTicketId`, then the in-flight/last persisted agent decision when exactly one active ticket exists, then the existing link. Store it and move an active linked ticket to `waiting_for_analyst` inside the same transaction. Pass the consulted ticket from `transferOverdue` and single-ticket handoffs in `ConsultationService`.
In `claim`, move the linked ticket to `in_progress` in the same transaction.
In `close`, load the linked ticket, validate the outcome by type (400 on mismatch), update the conversation, then transition the ticket; ignore outcomes without a linked active ticket.
Parse `SupportCloseInputSchema` in the controller; an empty body is valid for incidents.

- [ ] **Step 4: Run the suites**

Run: `npx vitest run --project integration apps/api/test/handoff.integration.test.ts apps/api/test/support.integration.test.ts apps/api/test/ticket-number-migration.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/tickets/status-transition.ts apps/api/src/conversations apps/api/src/consultation apps/api/src/human-support apps/api/test/handoff.integration.test.ts apps/api/test/support.integration.test.ts
git commit -m "feat(api): move ticket status with handoff, claim and close"
```

---

### Task 6: Deterministic consultation vocabulary

**Files:**
- Modify: `apps/api/src/agent/consultation/fixture-consultation.ts`
- Test: `apps/api/src/agent/consultation/fixture-consultation.integration.test.ts`

**Interfaces:**
- Consumes: `ticketStatusLabel` from `@nexo/contracts`.

- [ ] **Step 1: Write the failing assertion**

```ts
it('speaks the new status vocabulary and keeps the deadline', async () => {
  const reply = await run('Qual o status do chamado Notebook lento?');
  expect(reply.text).toContain('aberto');
  expect(reply.text).toContain('Prazo:');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run --project integration apps/api/src/agent/consultation/fixture-consultation.integration.test.ts`
Expected: FAIL with the old conditional text.

- [ ] **Step 3: Replace the binary status sentence**

Use `ticketStatusLabel(selected.status).toLowerCase()` in the sentence at line 343 and keep the `Prazo:`/overdue clauses.

- [ ] **Step 4: Run the suite**

Run: `npx vitest run --project integration apps/api/src/agent/consultation/fixture-consultation.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agent/consultation/fixture-consultation.ts apps/api/src/agent/consultation/fixture-consultation.integration.test.ts
git commit -m "feat(agent): use shared ticket status vocabulary"
```

---

### Task 7: Employee card and selection

**Files:**
- Modify: `apps/web/src/features/tickets/labels.ts`
- Modify: `apps/web/src/features/consultation/ticket-card.tsx`
- Modify: `apps/web/src/features/consultation/ticket-selection.tsx`
- Modify: `apps/web/src/app/globals.css`
- Test: `apps/web/e2e/ticket-card.spec.ts`

**Interfaces:**
- Consumes: `number`, `description`, `status` from `ConsultationTicketView`.
- Produces: CSS classes `.consultation-ticket-status.waiting_for_analyst`, `.in_progress`, `.approved`, and `.ticket-selection-number`.

- [ ] **Step 1: Write the failing browser test**

In the existing streamed-card test, give the ticket `number: 'INC-20311'`, `description: 'Lentidão geral desde a atualização.'`, and assert:

```ts
await expect(card.getByText('INC-20311', { exact: true })).toBeVisible();
await expect(card.getByText('Lentidão geral desde a atualização.')).toBeVisible();
await expect(card.getByText('Aguardando analista')).toBeVisible();
await page.setViewportSize({ width: 375, height: 812 });
await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 375);
```

Also keep the legacy fixture without `number` and assert the card still renders without an
`INC-`/`REQ-` reference.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx playwright test apps/web/e2e/ticket-card.spec.ts -g "streamed"`
Expected: FAIL (number/description not rendered).

- [ ] **Step 3: Implement the V03 composition**

`labels.ts` delegates `ticketStatusLabel` to the contract helper. `ticket-card.tsx` renders, in order: eyebrow (`Chamado` · number when present · status right-aligned), title, description when present, four-field grid (Categoria, Prioridade, Aberto em, Última atualização), footer `Prazo: … · Prazo vencido`. `ticket-selection.tsx` renders `ticket.number` before the title and keeps the status/date. Add the status color classes in `globals.css` using the existing tokens: waiting/overdue amber, in-progress blue, approved green, resolved gray.

- [ ] **Step 4: Run the browser file**

Run: `npx playwright test apps/web/e2e/ticket-card.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/tickets/labels.ts apps/web/src/features/consultation apps/web/src/app/globals.css apps/web/e2e/ticket-card.spec.ts
git commit -m "feat(web): render ticket number status and description in the chat"
```

---

### Task 8: Analyst close choice and ticket context

**Files:**
- Modify: `apps/web/src/features/support/support.tsx`
- Modify: `apps/web/src/features/support/support-detail.tsx`
- Modify: `apps/web/src/features/support/support-ticket-context.tsx`
- Test: `apps/web/e2e/support-detail.spec.ts`

**Interfaces:**
- Consumes: `conversation.contextTicketId`, `ticket.number`, `ticket.status`.
- Produces: `onClose: (outcome?: 'approved' | 'resolved') => void`.

- [ ] **Step 1: Write the failing browser test**

```ts
await expect(ticketPanel).toContainText('REQ-10442');
await expect(detail.getByRole('button', { name: 'Aprovar solicitação' })).toBeVisible();
await expect(detail.getByRole('button', { name: 'Concluir atendimento' })).toBeVisible();
```

Add `contextTicketId` and `number` to the existing fixtures; keep an incident case asserting only `Encerrar atendimento`.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx playwright test apps/web/e2e/support-detail.spec.ts -g "close"`
Expected: FAIL.

- [ ] **Step 3: Implement the choice**

`support.tsx` passes the outcome (`JSON.stringify(outcome ? { outcome } : {})`). `support-detail.tsx` finds `detail.conversation.contextTicketId` in `detail.tickets`; when it is a `REQ`, shows both buttons; otherwise shows `Encerrar atendimento`. `support-ticket-context.tsx` shows the number and the shared status label.

- [ ] **Step 4: Run the browser file**

Run: `npx playwright test apps/web/e2e/support-detail.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/support apps/web/e2e/support-detail.spec.ts
git commit -m "feat(web): let analysts approve or conclude a request"
```

---

### Task 9: Evidence and full gate

**Files:**
- Modify: `docs/ticket-consultation-verification.md`
- Modify: `docs/human-support-verification.md`
- Modify: `docs/challenge-acceptance.md`
- Modify: `docs/challenge-context.md`
- Add or update captures under `outputs/`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Run the whole gate**

Run: `npm run check`
Expected: PASS (typecheck, lint, format, unit, integration, build, Chromium). Record the actual test counts.

- [ ] **Step 2: Capture and compare**

Capture the consultation at 1440×900 and 375×812 and the analyst close choice; compare with the verified `vbsNW`/`CAqx8` guides, keeping app captures in `outputs/`.

- [ ] **Step 3: Record evidence honestly**

Document the executed checks, the conventions (illustrative PRD statuses, no `Recusado`, one linked ticket), and remaining gaps (analyst search by number, native pixel equivalence). Update B03/B09/B11/B13 rows.

- [ ] **Step 4: Commit**

```bash
git add docs outputs
git commit -m "docs: record ticket number and status evidence"
```
