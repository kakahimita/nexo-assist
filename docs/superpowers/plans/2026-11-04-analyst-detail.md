# Analyst Conversation Detail Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` task by task; review manually as required by AGENTS.md. This plan does not authorize implementation or merge. No model or execution method change is required to read it.

**Issue:** [#42](https://github.com/kakahimita/nexo-assist/issues/42), child scope of #9.

**Goal:** Refine the selected analyst conversation with ownership-aware controls, readable role-distinct messages and an authorized read-only ticket panel.

**Architecture:** Keep support REST endpoints and contracts unchanged. Pass the authenticated `UserView` from History to Support; compare its ID to persisted `assignedAnalystId`. Split presentation into focused components while Support coordinates selection and mutations. Server permissions remain authoritative.

**Tech Stack:** npm workspaces, strict TypeScript, Next.js/React, existing Zod contracts, Playwright and Vitest.

**Spec:** This proposed scope follows B10/B11/B13/B15 and V05 in `docs/challenge-acceptance.md`, `docs/human-support-verification.md`, original PRD analyst requirements and original Pencil frame `CAqx8`. Secondary visual guide: `screens/05-analyst-owned.png`. Owner requested issue and plan only; the implementation is pending approval/execution.

## Global Constraints

- Start execution from updated main, at least the PR #41 merge `287255a`. Create an isolated `feature/LAB-0042` branch/worktree; do not implement on main. Include this plan in that branch.
- Preserve all pre-existing local changes, untracked plans and other worktrees. Do not commit original references, databases, secrets, screenshots or generated app files.
- Read required context, architecture, workflow and applicable AGENTS.md files. Read installed Next.js documentation as required by `apps/web/AGENTS.md` before web edits.
- Engineering artifacts use English; visible copy uses Brazilian Portuguese.
- No new dependencies, migrations, contract changes, automatic polling, ticket writes, agent changes or redesign of the completed queue/navigation.
- Do not add unsupported presence, unread counts, remote-access functions, public ticket numbers, department, current analyst display name for another owner, or synthetic ownership timestamps/events.
- Only claim when waiting; only the assigned analyst may reply, return or close. Do not resume the agent automatically. Continue using existing server endpoints and validation.

## Sources and Proposed Layout

All reference assets were verified against `docs/challenge-reference-hashes.json` during planning. The secondary V05 image was inspected, as was the original Pencil frame structure: `CAqx8` is 1567×900, with a 64 px rail, 380 px list, flexible conversation and 340 px ticket history. Preserve the current application shell/queue rather than introducing the prototype rail in this delivery. At wide desktop widths use queue, flexible conversation, and 340 px ticket panel; fit the queue within available app space (cap at 380 px). Below 1200 px place tickets after the conversation; below 800 px stack queue then conversation then tickets. Use `minmax(0, 1fr)` and `min-width: 0` so long content wraps.

Conversation header: employee name, actual state and ownership label, with action controls. Body: handoff summary when present and role-distinct message list with real timestamps. Footer: a labeled reply textarea only for the current owner. Ticket context: all authorized employee tickets, with category, priority, status and deadline from the existing response. No invented distinction between “this conversation” and “other tickets”, because the contract has no authoritative link.

Before final CSS decisions, inspect original PRD pages 1–2, 4–5 and extract relevant Pencil frame children/tokens. Secondary renderings do not establish exact typography. Record visual differences rather than claiming full V05 acceptance.

## Review Focus

1. Selecting A then B with reversed network completion must never display A or allow actions against the wrong conversation.
2. Assigned-to-another, agent and closed states must not expose claim/reply/return/close as if owned by the current analyst.
3. Failed replies preserve the typed draft; failed mutations must not clear detail or claim success.
4. A successful write followed by a failed refresh must not be blindly retried, especially a reply with no idempotency key.
5. Long messages, missing author names and empty ticket/history arrays remain readable and keyboard-accessible on narrow screens.

## File Map and Interfaces

- Modify `apps/web/src/features/history/history.tsx`: pass existing server-loaded `user` to Support.
- Modify `apps/web/src/features/support/support.tsx`: accept `{ user: UserView; onLogout: () => void }`, coordinate guarded selection/mutations and per-conversation drafts.
- Create `apps/web/src/features/support/support-detail.tsx`: present selected detail and ownership-aware actions.
- Create `apps/web/src/features/support/support-ticket-context.tsx`: present `TicketView[]` using existing Portuguese labels.
- Modify `apps/web/src/app/globals.css`: scope detail/message/panel styling; preserve queue styles.
- Create `apps/web/e2e/support-detail.spec.ts`: controlled state, request-order, failure and layout cases.
- Modify `apps/web/e2e/support.spec.ts` only as needed to scope existing accessible selectors; keep real backend interactions.
- Modify `docs/human-support-verification.md` and `docs/challenge-acceptance.md`: executed evidence and remaining limits.
- Consume existing `UserView`, `SupportConversationView`, `MessageView` and `TicketView` from `@nexo/contracts`; do not change wire schemas.

### Task 1: Correct selection and ownership behavior

**Interfaces:** `SupportDetail` accepts `{ detail: SupportConversationView; user: UserView; busy: boolean; draft: string; error: string; onDraftChange: (value: string) => void; onClaim: () => void; onReply: () => void; onReturn: () => void; onClose: () => void }` and returns `React.JSX.Element`. Support owns the effects and state. Ownership is exactly `state === 'with_analyst' && assignedAnalystId === user.id`.

- [ ] Add browser fixtures for waiting, owned-by-self, owned-by-another, agent and closed states. Assert waiting offers only claim; owned-by-self offers reply/return/close; other states offer none. State labels are `Aguardando atendente`, `Você está atendendo`, `Em atendimento por outro analista`, `Com o agente`, and `Atendimento encerrado` respectively.
- [ ] Add controlled selection tests: delayed A success after B success, and delayed A error after B success, never replace B. Loading a different selection hides old detail and disables its actions; failed detail load offers `Tentar novamente` for that selected ID.
- [ ] Run `npm run test:e2e` and observe the new tests fail before production changes.
- [ ] Pass authenticated user from History. Extract SupportDetail and implement state-specific controls. The presentation check supplements, never replaces, backend ownership checks.
- [ ] Add AbortController/request-generation protection for detail selection and cleanup. Parse with `SupportConversationViewSchema`; protect all success/error state updates. Only publish a response when its conversation ID is still selected. Do not share the queue controller.
- [ ] Use an imperative ref guard for in-flight mutation plus `busy` for rendering. Disable queue selection and mutation controls while a write is in flight, pin the target ID at invocation, and never build the request from a later selection. Preserve current per-conversation draft across switching/filtering.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run test:e2e`; require passing results. Commit with `fix: guard analyst conversation selection and ownership`.

### Task 2: Preserve drafts and honest mutation outcomes

- [ ] Add browser cases for failed claim, reply, return and close (including 403/409): detail remains open; error is visible; no false completion notice; failed reply retains the exact typed text. Assert rapid double-click creates one in-flight request.
- [ ] Add a successful reply followed by failed GET case: the draft clears only after the POST succeeds; show `Resposta enviada. Não foi possível atualizar a conversa.` and a refresh-only retry. Retrying refresh sends no second POST. Do not offer automatic mutation retry.
- [ ] Run `npm run test:e2e`; observe failure before changing mutation handling.
- [ ] Clear action errors at the start of a new action, keep queue/detail/action errors separate, and clear a draft only after a successful reply POST. Use `SupportReplyInputSchema.safeParse({ content: draft.trim() })` before sending; show an accessible validation message for whitespace-only or over-4000-character input and send no request.
- [ ] On successful return/close, keep existing lifecycle behavior (clear selected detail and refresh queue); failed queue refresh does not turn a committed mutation into a failure. Show `Atendimento devolvido ao agente.` or `Atendimento encerrado.` only after POST success.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run test:e2e`; require passing results. Commit with `fix: preserve analyst drafts on failed support actions`.

### Task 3: Refine conversation and ticket presentation

**Interfaces:** `SupportTicketContext({ tickets, employeeName }: { tickets: TicketView[]; employeeName: string }): React.JSX.Element`. Reuse `categories`, `priorities`, `ticketStatusLabel` from `features/tickets/labels.ts`; use service timezone `America/Sao_Paulo` for dates. Keep backend timestamps and plain text content unchanged.

- [ ] Add browser assertions for all message roles: employee name, `Nexo Assist`, and real analyst `authorName` (fallback `Suporte`) identify speakers in text. Assert each timestamp has the original `dateTime`; malicious-looking HTML is rendered as text, never executed.
- [ ] Add fixtures with no messages/tickets: show `Nenhuma mensagem.` and `Nenhum chamado.`. With tickets show actual title, category, Portuguese priority/status, deadline and overdue marker. Do not imply ownership state changes ticket status.
- [ ] Run `npm run test:e2e`; observe the new presentation assertions fail.
- [ ] Present employee bubbles on the left, agent/analyst on the right with distinct blue/green treatments and speaker labels. Preserve message order and whitespace. Render handoff reason/summary/requested time from existing data, but do not fabricate a timestamped claim event.
- [ ] Present header actions and footer composer as described; use visible labels `Resposta`, `Enviar resposta`, `Devolver ao agente`, `Encerrar atendimento`, and `Assumir atendimento`. Waiting/read-only states show their explanatory status without an enabled composer. Keep focus visible and announce errors/statuses in scoped regions.
- [ ] Add ticket panel and scoped responsive grid using the proposed widths/breakpoints. Keep DOM order queue, conversation, ticket context. No placeholder buttons for search, remote access, overflow menus or unsupported ticket navigation.
- [ ] Test keyboard selection/action/composer access, long unbroken messages and long ticket titles at 1567×900, 1440×900 and 375×812; assert no horizontal document/panel overflow and no overlap. Confirm server-loaded content containing special characters stays readable.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm run test:e2e`; require passing results, including existing real employee→analyst→employee workflow. Commit with `feat: refine analyst conversation and ticket context`.

### Task 4: Verify and document delivery

- [ ] Ensure Chromium is installed and run `npm run check`. Integration/browser databases must remain isolated; preserve owner data and unrelated local services.
- [ ] Reuse existing backend role/claim/privacy/persistence integration coverage; record results rather than adding tests that merely mirror frontend predicates. No live-model claim follows from this UI delivery.
- [ ] Capture waiting, self-owned, other-owned, closed, detail-loading/error and ticket-empty states under `outputs/`. Compare desktop V05 at its native 1567×900 viewport and inspect 375×812 manually. Record source provenance, captures and differences; do not commit reference assets or app captures.
- [ ] Review manually for wrong-target writes, stale detail/errors, lost drafts, duplicate submissions, truthful status messages, Portuguese copy, keyboard access and CSS regressions in the queue.
- [ ] Update human-support verification and acceptance status with executed commands, reviewed revision, results, remaining V04/V05 differences and live-model checks skipped. Do not close all of #9.
- [ ] Commit evidence with `docs: record analyst detail verification`. Prepare a PR following the repository template with `Closes #42`, `Refs #9`, English description and Brazilian Portuguese `## Como testar`. Merge only after explicit owner authorization.

## Self-Review and Execution Handoff

- Task 1 covers race-safe selection and all ownership states; Task 2 covers failed and partially successful writes; Task 3 covers readable V05 composition; Task 4 covers full evidence and delivery.
- Both current weaknesses observed in planning are covered: ownership currently tests only conversation state; reply currently clears draft before POST success.
- The existing endpoint/contract provides no authoritative selected-ticket relation or claim timestamp, so neither is invented in this plan.
- Each review risk maps to a specific browser scenario. All checkbox steps are planned; no application tests or visual app comparison were run during planning.
- Execute this file on `feature/LAB-0042` with the original references available. Another model can follow the tasks sequentially; no delegation is required. Before implementing, review the proposed scope with the owner. This session created issue and plan only, not the branch, product code or PR.
