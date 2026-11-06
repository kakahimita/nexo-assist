# Demo Gemini key Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a demonstration evaluator configure a Gemini key on the login screen without editing local files.

**Architecture:** A temporary, in-memory key store is addressed by opaque HttpOnly cookie tokens. A pre-login token becomes an authenticated-session token at login, and the live consultation engine receives the session override without changing deterministic engines or the environment fallback.

**Tech Stack:** Next.js/React, NestJS, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-demo-gemini-key-design.md`

## Global Constraints

- Never persist, return, log, or render the API-key value after submission.
- Authentication and key-to-session association remain server-owned.
- Preserve `GOOGLE_API_KEY` as the fallback and use no real provider key in CI.
- User-facing copy is Brazilian Portuguese; source and tests are English.

## Review Focus

- An empty or whitespace-only key must not create a temporary key session.
- A temporary key must not be available after logout or API restart.
- A key typed in the password field must remain masked and keyboard-operable.
- A user who skips configuration must retain the environment-key behavior.
- Narrow-screen login must not overflow horizontally.

### Task 1: Temporary server-side key lifecycle

**Files:**
- Create: `apps/api/src/identity/session-model-key.store.ts`
- Modify: `packages/contracts/src/identity.ts`
- Modify: `apps/api/src/identity/identity.controller.ts`
- Modify: `apps/api/src/identity/identity.service.ts`
- Modify: `apps/api/src/identity/identity.module.ts`
- Test: `apps/api/src/identity/session-model-key.store.test.ts`
- Test: `apps/api/test/identity.integration.test.ts`

**Interfaces:**
- Produces: `SessionModelKeyStore.create(key)`, `claim(temporaryToken, sessionToken)`, `read(sessionToken)`, and `clear(sessionToken)`.

- [ ] Write unit and integration tests for storing a valid temporary key, claiming it at login, clearing it on logout, and rejecting invalid payloads.
- [ ] Run the focused tests and verify they fail because the endpoint and store do not exist.
- [ ] Implement the opaque-token in-memory store and the validated `POST /session/model-key` endpoint; claim the temporary value while creating the authenticated session and clear it at logout.
- [ ] Run focused tests and verify they pass.

### Task 2: Use the session override for live consultation

**Files:**
- Modify: `apps/api/src/consultation/consultation.controller.ts`
- Modify: `apps/api/src/consultation/consultation.service.ts`
- Modify: `apps/api/src/agent/consultation/types.ts`
- Modify: `apps/api/src/agent/consultation/mastra-consultation.ts`
- Test: `apps/api/src/agent/consultation/mastra-consultation.test.ts`

**Interfaces:**
- Consumes: `SessionModelKeyStore.read(sessionToken): string | undefined`.
- Produces: `ConsultationRequest.modelApiKey?: string`.

- [ ] Write a failing engine test that proves a request-level key wins over the environment configuration without changing the environment fallback.
- [ ] Run the focused test and verify it fails because the request cannot carry an override.
- [ ] Thread the optional key from the authenticated controller request to the live engine and select it only when provided.
- [ ] Run the focused test and verify it passes.

### Task 3: Login configuration UI

**Files:**
- Modify: `apps/web/src/features/identity/login.tsx`
- Modify: `apps/web/src/app/globals.css`
- Test: `apps/web/e2e/login-visual.spec.ts`

**Interfaces:**
- Consumes: `POST /api/session/model-key` with `{ modelApiKey: string }`.

- [ ] Write a failing browser test for keyboard submission, masked input, successful session-only confirmation, and narrow-screen overflow.
- [ ] Run the focused test and verify it fails because the controls do not exist.
- [ ] Implement the compact card and its request state; never retain the submitted value in React state after success.
- [ ] Run the focused test and verify it passes.

### Task 4: Verify and document scope

**Files:**
- Modify: `.github/pull_request_template.md` only if the current template needs a scope note; otherwise PR body only.

- [ ] Run formatting, type checking, unit, integration, build, and end-to-end verification.
- [ ] Inspect desktop and narrow login screenshots against the verified login reference and record the extension's intentional difference in the PR body.
