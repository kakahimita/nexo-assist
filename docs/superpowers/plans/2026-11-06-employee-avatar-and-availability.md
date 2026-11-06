# Employee Avatar and Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a signed-in employee's initials avatar and a truthful top-bar assistant availability state derived from API readiness.

**Architecture:** Keep the name transformation as a pure history-feature helper. Extend the existing health client with a readiness fetch and render the resulting loading, ready, and unavailable state in the signed-in employee layout; no identity, health-controller, or database contract changes are needed.

**Tech Stack:** TypeScript, Next.js/React, Zod contracts, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-employee-initials-avatar-design.md`.

## Global Constraints

- Use the server-provided authenticated user name; do not persist profile photos or alter identity APIs.
- Render the avatar decoratively beside the existing visible name and e-mail.
- "Assistente online" means only that `/api/ready` confirmed an initialized API/database; it does not claim model-provider availability or human presence.
- Loading and unavailable results must be textual, with retry available after an unavailable result.
- Keep user-facing copy in Brazilian Portuguese, strict TypeScript, existing contracts, keyboard usability, and narrow-screen support.
- Do not add dependencies, backend schema changes, model checks, presence counts, or unsupported prototype claims.

## Review Focus

1. A multi-part name with extra whitespace must still display the first and last initials; Task 1 covers it.
2. A single-part or blank name must not crash or create misleading text; Task 1 covers it.
3. A delayed or failed readiness request must never show the green online state; Task 2 covers loading, invalid/failed response, and retry.
4. The visible status must convey its meaning without colour and must cancel stale requests when the layout unmounts; Task 2 covers status text and cleanup.
5. At narrow widths, the avatar and the availability label must remain visible without horizontal overflow; Task 3 covers desktop and mobile browser assertions.

### Task 1: Add pure initials and readiness-client behavior

**Files:**
- Create: `apps/web/src/features/history/employee-initials.ts`
- Create: `apps/web/src/features/history/employee-initials.test.ts`
- Modify: `apps/web/src/features/system-status/api.ts`
- Modify: `apps/web/src/features/system-status/api.test.ts`

**Interfaces:**
- Produces `getEmployeeInitials(name: string): string`.
- Produces `fetchApiReadiness(baseUrl: string, signal?: AbortSignal): Promise<ReadinessResponse>` alongside the existing health function.
- Consumes the existing `ReadinessResponseSchema` and `ApiHealthError` failure categories.

- [ ] Write failing unit tests that expect `getEmployeeInitials(' Ana   Souza ')` to equal `AS`, `getEmployeeInitials('Ana')` to equal `A`, and whitespace-only input to equal an empty string.
- [ ] Run `npm test --workspace @nexo/web -- employee-initials.test.ts`; confirm the test fails because the helper does not exist.
- [ ] Implement `getEmployeeInitials(name: string): string` by trimming non-empty whitespace-separated parts and taking the uppercase first character of the first and last parts, or the first part alone.
- [ ] Run the initials test; confirm it passes.
- [ ] Write failing health-client tests that expect a valid `/ready` payload to parse and non-OK or invalid responses to reject with the existing `ApiHealthError` kinds.
- [ ] Run `npm test --workspace @nexo/web -- api.test.ts`; confirm the new readiness cases fail because no readiness fetch exists.
- [ ] Implement `fetchApiReadiness` using the current normalized base URL and error-handling conventions, targeting `/ready` and validating `ReadinessResponseSchema`.
- [ ] Run the focused web unit tests; confirm they pass.
- [ ] Commit the helper, readiness client, and tests with `feat: add employee initials and readiness client`.

### Task 2: Render employee availability and avatar

**Files:**
- Modify: `apps/web/src/features/history/history.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/e2e/profile.spec.ts`

**Interfaces:**
- Consumes `getEmployeeInitials(user.name)`, `fetchApiReadiness`, and `getApiBaseUrl`.
- Renders employee-topbar text for `loading`, `ready`, and `unavailable` availability states.

- [ ] Add failing Playwright scenarios for an authenticated Ana: the sidebar has a decorative `AS` avatar; an intercepted ready response shows `Assistente online`; a delayed request shows `Verificando disponibilidade`; and an error shows `Assistente indisponível` with `Tentar novamente`.
- [ ] Run `npm run test:e2e --workspace @nexo/web -- profile.spec.ts`; confirm the scenarios fail because the avatar and availability state are absent.
- [ ] Add state local to `History` that fetches API readiness after the employee layout mounts, aborts on cleanup, and retries only when the employee activates `Tentar novamente`.
- [ ] Render the decorative initials span before the unchanged name/e-mail and a top-bar `role="status"` availability control. Use the exact Brazilian Portuguese strings from the approved spec; show the green dot only with the ready response.
- [ ] Add scoped CSS for the circular avatar, compact top-bar availability presentation, focus-visible retry, and wrapping at the existing 700px breakpoint.
- [ ] Run the focused browser scenario; confirm it passes.
- [ ] Commit the layout, styles, and browser tests with `feat: show employee avatar and assistant availability`.

### Task 3: Verify the bounded UI increment and record evidence

**Files:**
- Modify: `docs/challenge-acceptance.md`
- Modify: `docs/superpowers/specs/2026-11-06-employee-initials-avatar-design.md` only if evidence terminology needs clarification

**Interfaces:**
- Consumes the completed UI behavior and fresh command outputs from Tasks 1 and 2.
- Produces a concise Issue #50 evidence note that distinguishes API readiness from model or human availability.

- [ ] Run `npm run format`, then `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:integration`, `npm run build`, and `npm run test:e2e`; record exact outcomes and any skipped command.
- [ ] Capture and manually inspect employee desktop and 375px screenshots against the verified V03/V06 secondary guides. Confirm the initials and availability text remain legible, no horizontal overflow occurs, and online is not confused with a model or human guarantee.
- [ ] Update the acceptance record with executed Issue #50 evidence, source provenance, and remaining V03/V06 fidelity limits; do not claim exact native-export comparison.
- [ ] Inspect `git diff` for scope, authenticated identity use, copy, accessibility, and unintentional changes.
- [ ] Commit the evidence with `docs: record employee availability verification`.
- [ ] Prepare, but do not merge, a PR titled `feature/LAB-0050: add employee avatar and availability` using the repository template, `Closes #50`, and `Refs #9`.

## Plan Self-Review

- The avatar's name transformation is isolated and explicitly covered for normal, single-name, whitespace, and blank inputs in Task 1.
- The readiness client, all displayed availability states, retry, and cleanup are owned by Tasks 1 and 2; no client value invents availability.
- Task 2 includes the requested desktop presentation and Task 3 explicitly checks narrow-screen overflow against the relevant visual references.
- Task 3 records only fresh evidence and preserves the distinction between API readiness and model/human availability.
- No backend contract, persistence, credential, provider, or presence-count work was introduced because the existing ready endpoint is the selected trustworthy signal.
