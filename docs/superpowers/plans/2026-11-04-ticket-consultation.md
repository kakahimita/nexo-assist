# Ticket consultation in chat and automatic overdue transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development, whichever the owner chooses, to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the ticket consultation inside the employee chat (selection list, then a detail card) and transfer the conversation to an analyst automatically when the consulted ticket is overdue, enforced in backend code.

**Architecture:** The consultation service (`apps/api/src/consultation/consultation.service.ts`) reads the `consult-tickets` tool result after each tool call. When one owned ticket is overdue, it stops the engine, persists a deterministic agent message with the ticket card, and requests the handoff. This check runs for both the deterministic engine and the live Mastra engine, so the model cannot skip it. The web chat renders the selection list (existing buttons) and a new detail card for a single ticket.

**Tech Stack:** TypeScript (strict), NestJS, Zod contracts (`packages/contracts`), Prisma/SQLite, Vitest, Next.js/React, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-04-ticket-consultation-design.md`

## Global Constraints

- Overdue is computed on the server only, by `isOverdue` in `apps/api/src/tickets/rules.ts`. The frontend never computes it.
- Times are stored in UTC; formatting uses `America/Sao_Paulo` (as in `apps/web/src/features/tickets/tickets.tsx`).
- Labels shown to the employee are in Brazilian Portuguese; code, names and commits are in English.
- Handoff rules follow PRD Annex A and acceptance B09. The prototype's "offer" wording does not override them.
- Do not stage `AGENTS.md` (the owner's uncommitted port rule) or unrelated untracked plan files.
- Before writing any code under `apps/web`, read the Next.js guide in `node_modules/next/dist/docs/` (required by `apps/web/AGENTS.md`).
- Commits: small, imperative, English, `feat:` / `fix:` / `test:` / `docs:` prefixes as in the existing history.

## Review Focus

1. A model-driven turn gets an overdue ticket from the tool, then answers as if no handoff is needed → must still transfer, with the deterministic message (Task 3, service test).
2. Several tickets match and one is overdue → selection only, no transfer until the employee chooses (Task 3, service test).
3. Another employee's overdue ticket with the same title → never consulted, never transfers (Task 3, integration test).
4. Restart while waiting for an analyst → the agent message with the card and the `waiting_for_analyst` state are restored (Task 3, integration test; Task 6, browser test).
5. An analyst claims the conversation before the agent message is saved → no duplicate message and no second handoff (Task 3, service test).
6. A decision stored before this change has no `lastUpdate` → it still parses and the card shows no date (Task 1, contract test).

Known limit (recorded in Task 7): when the live model never calls `consult-tickets`, the backend cannot know the ticket was consulted. Live reliability belongs to #10.

---

## Task 0: Create the branch and commit the design

**Files:**
- Create: `docs/superpowers/plans/2026-11-04-ticket-consultation.md` (this file)
- Keep: `docs/superpowers/specs/2026-11-04-ticket-consultation-design.md`

- [ ] **Step 1: Create the branch from `main`**

Run: `git switch -c feature/LAB-0036`
Expected: `Switched to a new branch 'feature/LAB-0036'`

- [ ] **Step 2: Commit only the design and plan**

```bash
git add docs/superpowers/specs/2026-11-04-ticket-consultation-design.md docs/superpowers/plans/2026-11-04-ticket-consultation.md
git commit -m "docs: add ticket consultation design and plan"
```

Expected: one commit; `git status` still lists `AGENTS.md` as modified and unstaged.

---

## Task 1: Add `lastUpdate` to the consultation ticket contract

**Files:**
- Modify: `packages/contracts/src/consultation.ts:28-35` (`ConsultationTicketViewSchema`)
- Test: `packages/contracts/src/consultation.test.ts`

**Interfaces:**
- Produces: `ConsultationTicketView` gains `lastUpdate: string | null` (ISO datetime; `null` only for decisions stored before this change). Schema: `lastUpdate: z.string().datetime().nullable().default(null)`.

- [ ] **Step 1: Write the failing test**

In `consultation.test.ts`, add a case: a ticket view with `lastUpdate: '2026-11-01T12:00:00.000Z'` parses; the same object without `lastUpdate` parses and yields `lastUpdate: null`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w packages/contracts -- consultation`
Expected: FAIL (`lastUpdate` is rejected by the strict object).

- [ ] **Step 3: Add the field**

Add `lastUpdate: z.string().datetime().nullable().default(null),` to `ConsultationTicketViewSchema` after `deadline`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w packages/contracts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/consultation.ts packages/contracts/src/consultation.test.ts
git commit -m "feat: add last update to consultation ticket view"
```

---

## Task 2: Fill `lastUpdate` from the clock start

**Files:**
- Modify: `apps/api/src/agent/tools/consultation-tools.ts:189-196` (`consultTickets` candidate mapping)
- Modify: `apps/api/src/agent/consultation/turn.ts:70-78` (duplicate-candidate mapping)
- Test: `apps/api/src/agent/tools/consultation-tools.test.ts` (create if absent, following the existing test layout under `apps/api/src/agent/tools/`)

**Interfaces:**
- Consumes: `TicketView.slaStartedAt` (already returned by `TicketService.list`).
- Produces: every `ConsultationTicketView` returned by `consult-tickets` and by duplicate candidates carries `lastUpdate = slaStartedAt`.

- [ ] **Step 1: Write the failing test**

Assert that `consultTickets` returns each owned ticket with `lastUpdate` equal to the ticket's `slaStartedAt`, and that a ticket reopened later reports the reopening time.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -w apps/api -- consultation-tools`
Expected: FAIL (`lastUpdate` missing).

- [ ] **Step 3: Map the field**

In `consultTickets`, destructure `slaStartedAt` and map `lastUpdate: slaStartedAt`. In `turn.ts`, do the same in the duplicate-candidate mapping, using `slaStartedAt` from the `TicketView` candidates.

- [ ] **Step 4: Run the tests**

Run: `npm test -w apps/api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/agent/tools/consultation-tools.ts apps/api/src/agent/consultation/turn.ts apps/api/src/agent/tools/consultation-tools.test.ts
git commit -m "feat: report ticket clock start as last update"
```

---

## Task 3: Enforce the overdue transfer in the consultation service

**Files:**
- Modify: `apps/api/src/consultation/consultation.service.ts` (the `for await` loop in `run`, lines 46-77)
- Test: `apps/api/src/consultation/consultation.service.test.ts` (unit, fake engine and fake conversations service)
- Test: `apps/api/src/consultation/consultation.service.integration.test.ts` (real isolated database, following `apps/api/src/agent/consultation/fixture-consultation.integration.test.ts`)

**Interfaces:**
- Consumes: `ConsultTicketsResultSchema` from `apps/api/src/agent/tools/consultation-tool-schemas.ts`; `ConsultationTurn` from `apps/api/src/agent/consultation/turn.ts`; `ConversationsService.appendAgentTurnIfCurrent`, `ConversationsService.requestHandoff`.
- Produces: `ConsultationService.run` ends a turn with `done` (the saved message) followed by `handoff-waiting` when a consulted ticket is overdue.

- [ ] **Step 1: Write the failing unit tests**

Cover, with a fake engine that yields events in this order: `tool-result` (`consult-tickets`), `text-delta`, `decision` with action `answer`.
- One owned ticket, overdue → `requestHandoff` called once with `'overdue_ticket'`; the saved message content is the deterministic text (the model text is not saved); the stream yields `done` then `handoff-waiting`. (Review focus 1.)
- `match: 'multiple'`, one overdue → no handoff; the normal answer is saved. (Review focus 2.)
- `appendAgentTurnIfCurrent` returns `null` → no `requestHandoff`, the stream yields only `handoff-waiting`. (Review focus 5.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w apps/api -- consultation.service`
Expected: FAIL.

- [ ] **Step 3: Implement the check**

Inside the loop, after `turn.apply(event)`:

```ts
// After turn.apply(event): stop on an overdue consulted ticket.
// Order matters: save the message first, then request the handoff,
// because requestHandoff needs the conversation state it still finds as 'agent'.
const overdue = overdueConsultedTicket(event);
if (overdue) {
  // build a ConsultationDecisionView: action 'handoff', confidence 1,
  // tickets [overdue], actions/evidence from turn.partial(), draftId null,
  // outcome 'completed', errorCode null, source engine.source
  // content: `${overdue.title} está com o prazo vencido. Transferi a conversa para um analista, com o resumo do caso. Até ele devolver a conversa, eu não respondo por aqui.`
  // appendAgentTurnIfCurrent(...); null → yield handoff-waiting and return
  // else yield done(message); await requestHandoff(user, conversationId, 'overdue_ticket'); yield handoff-waiting; return
}
```

`overdueConsultedTicket` is a small pure helper in the same file: it returns the single ticket only when the event is a successful `consult-tickets` `tool-result` with `match === 'one'` and `tickets[0].overdue === true`. Use `ConsultTicketsResultSchema.safeParse`.

The engine's own `handoff` event stays as it is; the check above runs first, so the engine event is not reached for overdue tickets.

- [ ] **Step 4: Run the unit tests**

Run: `npm test -w apps/api -- consultation.service`
Expected: PASS.

- [ ] **Step 5: Write and run the integration test**

Using a real isolated database, cover:
- The overdue turn persists an agent message whose decision contains the ticket and whose conversation is `waiting_for_analyst`; reloading messages returns the same message and state. (Review focus 4.)
- Another employee's overdue ticket with the same title is never consulted by this employee and creates no handoff. (Review focus 3.)

Run: `npm run test:integration -w apps/api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/consultation/
git commit -m "feat: transfer overdue consulted tickets in the backend"
```

---

## Task 4: Ticket detail card and formatting helpers (web)

**Files:**
- Create: `apps/web/src/features/tickets/labels.ts` (move `priorities` from `tickets.tsx:24-29`, add `ticketStatusLabel`)
- Modify: `apps/web/src/features/tickets/tickets.tsx` (import the moved map; no behavior change)
- Create: `apps/web/src/features/consultation/ticket-card.tsx`
- Create: `apps/web/src/features/consultation/ticket-card-format.ts` (pure: `formatElapsed(value, now)`, `formatDeadline(value)` in `America/Sao_Paulo`)
- Test: `apps/web/src/features/consultation/ticket-card-format.test.ts`

**Interfaces:**
- Consumes: `ConsultationTicketView` (with `lastUpdate`).
- Produces: `TicketCard({ ticket, now })` renders the title, status, priority, deadline, last update, and a visible text marker "Prazo vencido" when `overdue` is true. `formatElapsed` returns Portuguese text such as `há 5 dias` or `há 3 horas`; it returns `—` when `lastUpdate` is `null`.

- [ ] **Step 1: Read the Next.js guide** (see Global Constraints) and note any client-component rules that apply.

- [ ] **Step 2: Write failing tests for the pure formatter**

Cover: 5 days elapsed → `há 5 dias`; 3 hours → `há 3 horas`; `null` → `—`; deadline formatted in `America/Sao_Paulo`.

- [ ] **Step 3: Run them to verify they fail**

Run: `npm test -w apps/web -- ticket-card-format`
Expected: FAIL.

- [ ] **Step 4: Implement the formatter, the labels move, and `TicketCard`**

The card has no buttons, so it does not change the existing button queries used by the e2e tests. The "Prazo vencido" marker is text, not color only.

- [ ] **Step 5: Run the web tests and typecheck**

Run: `npm test -w apps/web` then `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/tickets/labels.ts apps/web/src/features/tickets/tickets.tsx apps/web/src/features/consultation/ticket-card.tsx apps/web/src/features/consultation/ticket-card-format.ts apps/web/src/features/consultation/ticket-card-format.test.ts
git commit -m "feat: add ticket detail card for the chat"
```

---

## Task 5: Wire the card into the chat

**Files:**
- Modify: `apps/web/src/features/consultation/consultation.tsx:243-255` (`ticket-options` block)
- Modify: `apps/web/src/app/globals.css` (card styles, near `.ticket-card` at line 661)

**Interfaces:**
- Consumes: `TicketCard` from Task 4; `message.decision.tickets`, `message.decision.action`.

- [ ] **Step 1: Keep the selection buttons for several tickets**

Keep the existing buttons (button text = ticket title, `send(ticket.title)`), so the current e2e flows and the duplicate-candidate flow still work.

- [ ] **Step 2: Render the card for one ticket**

When `decision.tickets.length === 1`, render `<TicketCard>` in the agent message, after the text.

- [ ] **Step 3: Hide option buttons on a handoff message**

When `decision.action === 'handoff'`, do not render the ticket buttons or quick replies. An overdue message must not offer to send another ticket choice to an analyst-owned conversation.

- [ ] **Step 4: Verify manually and with the existing e2e**

Run: `npm run test:e2e -w apps/web -- consultation.spec.ts`
Expected: PASS (B02, B03, B12, mobile overflow). Inspect `outputs/consultation-desktop.png` against `references/challenge/screens/03-ticket-consultation.png` at 1440×900 and record the observed differences in Task 7.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/consultation/consultation.tsx apps/web/src/app/globals.css
git commit -m "feat: show ticket detail in the employee chat"
```

---

## Task 6: Browser test for the overdue transfer

**Files:**
- Create: `apps/web/e2e/ticket-overdue-transfer.spec.ts`

**Interfaces:**
- Consumes: the `start` and `send` helpers pattern from `apps/web/e2e/consultation.spec.ts` (copy them; do not import from another spec).

- [ ] **Step 1: Write the test**

Log in as `ana.souza@nexo.com.br`, start a new conversation, send `Qual o status do meu chamado?`, click the "Notebook lento" option, and expect: the card shows "Prazo vencido"; the status region says "Aguardando atendimento humano"; the composer is disabled or absent; no ticket option buttons appear in the handoff message. Reload the page and expect the same state. (Review focus 4, browser side.)

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -w apps/web -- ticket-overdue-transfer.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/ticket-overdue-transfer.spec.ts
git commit -m "test: cover overdue ticket transfer in the browser"
```

---

## Task 7: Verification record and acceptance status

**Files:**
- Create: `docs/ticket-consultation-verification.md` (executed evidence, limits, and skipped checks)
- Modify: `docs/challenge-acceptance.md` (update the B03 and B09 status text only)

- [ ] **Step 1: Run the full checks**

Run, in order: `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`, `npm run build`, `npm run test:e2e`.
Expected: all PASS. Record any failure and its cause; do not hide it.

- [ ] **Step 2: Record evidence**

In the verification doc, list each executed command with its result, the review-focus test that covers each item, the screenshot comparison result against `03-ticket-consultation.png` (differences noted, not hidden), and the known limit about live models. Mark the live model check as not run.

- [ ] **Step 3: Commit**

```bash
git add docs/ticket-consultation-verification.md docs/challenge-acceptance.md
git commit -m "docs: record ticket consultation verification"
```

---

## Self-Review

- **Spec coverage:** card inside chat (Task 4-5), selection (Task 5 keeps buttons), last update from `slaStartedAt` (Task 2), backend-enforced overdue handoff (Task 3), no option buttons on handoff (Task 5), no "Adicionar informação" / "Não, obrigado" on overdue (Task 5 hides buttons on handoff messages), Chamados tab untouched (no task touches it).
- **Type consistency:** `lastUpdate: string | null` is defined in Task 1 and used in Tasks 2, 4. `overdue_ticket` is an existing `HandoffReason`. `ConsultTicketsResultSchema` is used in Task 3 as in `turn.ts`.
- **Prototype options not added:** the "Adicionar informação" and "Não, obrigado" buttons from Screen 3 do not exist in the code, and this plan does not add them. With automatic transfer on overdue, they have no role in that case; Task 5 only prevents the existing ticket buttons from appearing on handoff messages.
