# Issue 4: Identity and History Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Review manually unless the owner explicitly requests delegation, as required by `AGENTS.md`.

**Goal:** Verify the already merged identity and history increment against issue #4, record evidence for the revision actually tested, and identify any remaining acceptance gaps.

**Architecture:** NestJS owns fixture identities, opaque server sessions and employee-scoped conversation access; Prisma/SQLite persists sessions and history. Next.js forwards same-origin requests and displays login and history; shared Zod contracts validate input and response shapes. Existing analyst login is in scope, while the support console and ownership lifecycle belong to #8.

**Tech Stack:** Node `>=22.23.2 <23`, npm `>=10.9.8 <11`, npm workspaces, strict TypeScript, Next.js, NestJS, Prisma/SQLite, Zod, Vitest, Supertest, Playwright.

**Spec:** [Issue #4](https://github.com/kakahimita/nexo-assist/issues/4), `docs/challenge-context.md`, `docs/challenge-acceptance.md` (B01, relevant part of B13, B16, V01), `docs/architecture.md`, and the original PRD pages 1–2 and 4–5. For visual review use frame `bi8Au` in the verified private `originals/nexo.pen` and `screens/01-login.png`; see `docs/challenge-references.md`.

## Global Constraints

- Engineering artifacts use English; user-facing copy and explanations use Brazilian Portuguese.
- Known fictional employee and analyst identities accept any nonempty password; reject unknown identities. This is demonstration authentication.
- Identity, authorization and database access belong to the backend; employees cannot access another employee's history.
- Sessions use HttpOnly cookies; conversations and messages survive an application restart.
- Use isolated temporary databases for integration and browser tests; CI needs no real model key.
- Keep original reference files private and separate from application screenshots; report native Pencil export limitations.
- Follow `docs/development-workflow.md`, preserve existing local changes, use an issue-derived branch, and never merge without explicit owner instruction.

## Review Focus

The existing tests below exercise the five most relevant failure classes; Task 1 reruns them against the selected revision and Task 2 requires a regression test only if a gap is found.

1. Forged identity or role in request bodies must not change the authenticated user: `apps/api/test/identity.integration.test.ts` and `conversations.integration.test.ts`.
2. Malformed, expired or revoked session cookies must not grant access: `apps/api/test/identity.integration.test.ts`.
3. Another employee's conversation ID must not disclose messages or permit writes: `apps/api/test/conversations.integration.test.ts`.
4. Restart must restore the existing session and message without replaying a write: `apps/api/test/conversations.integration.test.ts` and `apps/web/e2e/restart.spec.ts`.
5. Failed login or an unavailable session service must show usable feedback: `apps/web/e2e/identity-history.spec.ts`.

---

## Current state and file map

- PR [#15](https://github.com/kakahimita/nexo-assist/pull/15) merged `acce250` into `main` as `82402ed`; issue #4 was still open when this plan was written. The earlier plan, `docs/superpowers/plans/2026-10-31-identity-and-history.md`, describes work already implemented; its unchecked boxes are not evidence that code is missing.
- `apps/api/src/identity/`, `apps/api/src/conversations/`, `apps/api/prisma/` and `packages/contracts/src/`: existing session, access, persistence and wire-contract implementation.
- `apps/api/test/identity.integration.test.ts`, `apps/api/test/conversations.integration.test.ts`, `apps/web/e2e/identity-history.spec.ts`, `apps/web/e2e/restart.spec.ts` and `apps/web/e2e/login-visual.spec.ts`: existing acceptance coverage.
- `apps/web/src/features/identity/` and `apps/web/src/features/history/`: existing minimal user interface; read `apps/web/AGENTS.md` and the relevant installed Next.js documentation before any web code change.
- `docs/identity-history-verification.md`, `docs/challenge-acceptance.md`, `docs/challenge-context.md` and `docs/roadmap.md`: evidence and status to update only when supported by new results.

### Task 1: Verify the merged increment

**Files:** Read the implementation and tests in the file map; write test output and application screenshots only under ignored local output directories. No application changes are assumed.

**Interfaces:** Consumes the existing `POST/GET/DELETE /api/session` and `GET/POST /api/conversations`, `GET/POST /api/conversations/:id/messages` interfaces. Produces a list of observed pass/fail/skip results tied to the tested Git revision.

- [ ] Confirm `git status`, `git rev-parse HEAD`, and `git merge-base --is-ancestor acce250 HEAD`; preserve the pre-existing `apps/web/next-env.d.ts` change. Execute on a revision containing merged PR #15, following the issue branch/worktree workflow; do not reset or overwrite local changes.
- [ ] Run `npm run check` after installing Playwright Chromium if needed. Expected: typecheck, lint, unit, integration, build and browser checks all exit 0. Record each failed or skipped stage and do not treat unrun later stages as passed.
- [ ] Review the existing tests named in Review Focus and `apps/web/e2e/login-visual.spec.ts` against B01, B13, B16 and V01; confirm that assertions and test setup match their stated outcomes. Record uncovered issue #4 criteria separately from full-challenge criteria assigned to later issues.
- [ ] Manually review the current login at 1440 × 900 and 390 × 844, keyboard operation and error feedback against verified `bi8Au` and the owner-supplied rendering. Save application screenshots outside `references/` and note that the rendering is not a native Pencil export. If references cannot be restored or verified, record the visual check as blocked rather than passed.

### Task 2: Resolve only demonstrated issue #4 gaps

**Files:** Change only the specific existing implementation, contract and test files identified by Task 1; if Task 1 finds no gap, skip this task.

**Interfaces:** Consumes Task 1 findings and the existing HTTP interfaces above; preserves their contract unless a specific acceptance failure requires a documented change.

- [ ] For each demonstrated failure, add a focused test in its owning existing integration or browser test file asserting the issue criterion and expected response or persisted state. For example, unauthorized access must return 404 for another employee's conversation and reveal no message.
- [ ] Run the affected test using `npm run test:integration` or `npm run test:e2e`; expected: the new regression test fails for the observed reason before the fix.
- [ ] Apply the smallest correction in the owning module. Keep user identity server-derived and do not add ticket, model or analyst-support functionality reserved for later issues.
- [ ] Rerun the affected command; expected: the new regression test and existing tests pass. Repeat the full `npm run check` after all code changes; record failures or skips.
- [ ] Review the diff manually and commit the focused correction on the issue-derived branch with an imperative English message. Do not commit generated files or pre-existing unrelated changes.

### Task 3: Record evidence and prepare the handoff

**Files:** Modify `docs/identity-history-verification.md`, `docs/challenge-acceptance.md`, `docs/challenge-context.md`, and `docs/roadmap.md` only as supported by Tasks 1–2. If code or documentation changes are needed, prepare an issue-linked follow-up PR using the repository template.

**Interfaces:** Consumes the tested revision and actual results from Tasks 1–2; produces traceable evidence and an accurate distinction between issue #4 and later challenge work.

- [ ] Record the exact tested revision, command outcomes, test counts when available, manual review findings and reference provenance. Keep `e01bbb8` evidence historically attributed to that revision; do not imply the new run occurred if it did not.
- [ ] Update the roadmap and context to say PR #15 is merged, and state whether #4's own acceptance criteria passed. Keep B13's ticket and human-ownership persistence and the analyst console assigned to #5/#8 until independently demonstrated; keep V01 partial if visual fidelity remains unverified.
- [ ] Run `git diff --check` and inspect `git diff` and `git status`; expected: no whitespace errors, secrets, original assets, unrelated changes or unsupported completion claims.
- [ ] If tracked changes exist, commit the documentation separately with `docs: update identity and history evidence`, and prepare a PR linked to #4 with verified results and `## Como testar` in Brazilian Portuguese. If no tracked change is needed, report the results without manufacturing one. Close #4 only when its acceptance criteria are demonstrated; do not merge a follow-up PR without explicit owner instruction.
