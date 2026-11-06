# Employee Chat Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine V02/V03 chat presentation and replace multi-ticket action buttons with accessible single-choice selection.

**Architecture:** Extend `Consultation` and add a focused `TicketSelection` component. Existing `send(ticket.title)` remains the sole selection action. Keep backend contracts and ticket/handoff rules unchanged.

**Tech Stack:** Next.js/React, TypeScript, Zod contracts, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-employee-chat-fidelity-design.md`.

## Global Constraints

- Work only in `feature/LAB-0044`; preserve unrelated files and existing behavior.
- UI uses only server-provided ticket/decision data. Preserve privacy, overdue handoff, confirmation, streams and session limit.
- Do not add ticket numbers/descriptions, APIs, dependencies, model changes or native-export claims.
- Test at 1440×900 and 375×812, using the private verified V02/V03 sources for comparison.

## Review Focus

1. A multi-ticket selection cannot send before a radio choice and sends only the selected existing title.
2. Handoff decisions never expose ticket selection or quick replies.
3. Draft confirm/edit/cancel and duplicate-disambiguation remain operable after presentation changes.
4. Partial, quota and error states preserve truthful status/composer behavior without overflow.
5. Long text and legacy null metadata wrap with textual role/action context.

### Task 1: Accessible ticket selection

**Files:**
- Create `apps/web/src/features/consultation/ticket-selection.tsx`.
- Modify `apps/web/src/features/consultation/consultation.tsx`.
- Modify `apps/web/e2e/ticket-card.spec.ts`.

**Interfaces:** `TicketSelection({ tickets, disabled, onSelect }: { tickets: ConsultationTicketView[]; disabled: boolean; onSelect: (ticket: ConsultationTicketView) => void }): React.JSX.Element`; it owns selected ID and calls `onSelect` only after `Ver detalhes` form submission.

- [ ] Write browser cases with two authorized tickets: `Chamados encontrados` radio group, disabled `Ver detalhes`, keyboard choice and selected-title-only submission.
- [ ] Run `npm run test:e2e --workspace @nexo/web -- ticket-card.spec.ts`; expect failure because current choices are direct buttons.
- [ ] Implement the smallest component: local selected ID, lookup in input tickets, radio status/overdue text, guarded form submit.
- [ ] Render it only for completed non-handoff decisions with more than one ticket; retain single-ticket `TicketCard`.
- [ ] Add an overdue/multiple-ticket handoff regression asserting no fieldset or quick replies.
- [ ] Run the focused browser test; expect pass.
- [ ] Commit `feat: add accessible ticket selection in chat`.

### Task 2: Message hierarchy and responsive layout

**Files:**
- Modify `apps/web/src/features/consultation/consultation.tsx`.
- Modify `apps/web/src/app/globals.css`.
- Modify `apps/web/e2e/conversation-layout.spec.ts` and affected draft/consultation browser tests.

- [ ] Write browser assertions for textual employee/agent/analyst speaker context, grouping of agent actions/details/cards/controls, and empty/partial/error/quota/waiting/closed states.
- [ ] Run focused conversation layout coverage; expect failure before markup/CSS change.
- [ ] Add scoped message hierarchy and responsive styling: bounded readable column, role-distinct surfaces, wrapping controls and visible focus. Keep DOM chronological.
- [ ] Add 1440×900 and 375×812 long-content overflow/keyboard tests and rerun draft confirmation, consultation, and overdue handoff scenarios.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:e2e`; expect pass.
- [ ] Commit `feat: refine employee chat message hierarchy`.

### Task 3: Evidence and delivery

**Files:**
- Modify `docs/ticket-consultation-verification.md`, `docs/conversational-drafts-verification.md`, `docs/challenge-acceptance.md`.

- [ ] Run `npm run check` with isolated test databases and record actual outcomes.
- [ ] Capture V02/V03 states locally at desktop/mobile, compare with private references and document remaining differences.
- [ ] Review privacy, disabled state, keyboard focus and overflow manually.
- [ ] Commit verification with `docs: record employee chat fidelity verification`.
- [ ] Prepare, but do not merge, a PR with `Closes #44` and `Refs #9`.

## Self-Review

Task 1 owns selection behavior and handoff suppression. Task 2 owns all visual/state regressions. Task 3 owns final evidence and records remaining #9 scope; it does not claim live-model reliability or full #9 completion.
