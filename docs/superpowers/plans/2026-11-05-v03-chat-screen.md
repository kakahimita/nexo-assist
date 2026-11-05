# V03 Chat Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the employee consultation and transfer screen follow Pencil V03 without inventing ticket facts or changing PRD handoff rules.

**Architecture:** The employee shell resumes the latest conversation or creates the first one, with no permanent new-conversation control. Consultation renders contextual actions from agent decisions and keeps human support available for quota and session-limit failures. Ticket selection sends the chosen authorized title in one interaction. CSS gives the desktop chat a scrolling message region and a footer composer.

**Tech Stack:** Next.js, React, strict TypeScript, Playwright, npm workspaces.

**Spec:** Original Pencil frame `vbsNW` in the hash-verified private bundle, PRD v5 Annex A/C, `docs/challenge-acceptance.md`.

## Global Constraints

- Work in `feature/LAB-0046` under issues #48 and #9; leave PR #47 draft.
- User-facing copy is Brazilian Portuguese; engineering artifacts are English.
- Do not display invented public ticket numbers, descriptions, richer statuses, or assistant presence.
- Keep overdue handoff automatic and durable; a model choice cannot override PRD rules.
- Preserve the 30-message cap, quota fallback to human support, keyboard access, and mobile layout.

## Review Focus

1. First employee login opens an interactive chat with no permanent new-conversation button.
2. Reload resumes the newest conversation without a visible history list.
3. Selecting a ticket sends exactly one authorized title without a second button.
4. Analyst contact is shown only as contextual agent output or a failure/session fallback, and never after handoff.
5. Desktop 1440×900 keeps the composer inside the viewport; mobile 375×812 has no horizontal overflow.

## Tasks

### Task 1: Open chat without a permanent action

**Files:** `apps/web/src/features/history/history.tsx`, employee navigation and history browser tests.

- [x] Add failing browser coverage for automatic first conversation and absence of a permanent `Nova conversa` button.
- [x] Implement first-conversation creation and latest-conversation restoration; retain contextual session-limit and closed-state restart.
- [x] Update browser setup to create isolated conversations through the API when needed, and rerun focused tests.

### Task 2: Contextual agent actions and ticket selection

**Files:** `apps/web/src/features/consultation/{consultation,ticket-selection}.tsx`, consultation and handoff browser tests.

- [x] Add failing tests for no initial analyst button, agent-provided analyst action, and one-click ticket selection.
- [x] Render analyst contact in the agent response when offered; expose direct human fallback on quota/cap without depending on the model.
- [x] Render authorized ticket rows with status colors and select in one click/keyboard activation.
- [x] Verify automatic overdue transfer still suppresses optional actions.

### Task 3: V03 message and composer composition

**Files:** `apps/web/src/features/consultation/consultation.tsx`, `apps/web/src/app/globals.css`, conversation layout browser tests.

- [x] Add failing 1440×900 geometry and 375×812 overflow assertions.
- [x] Move the visible message heading out of the layout, group contextual options with the agent bubble, and place the single-ticket card before the explanation.
- [x] Keep the message region scrollable and the 48 px composer at the panel footer; verify keyboard and long-content states.

### Task 4: Evidence and delivery

**Files:** `docs/employee-visual-verification.md`, `docs/challenge-acceptance.md`, PR #47.

- [x] Run `npm run check` on isolated ports/databases and inspect a desktop V03 capture against the Pencil frame.
- [x] Record measured improvements and remaining source/backend differences, update the draft PR, and leave localhost:3000/3001 running.

## Self-Review

The plan covers all user-raised V03 gaps while keeping unavailable ticket metadata and PRD-overdue behavior explicit. The existing draft PR remains open for broader V01-V06 fidelity.
