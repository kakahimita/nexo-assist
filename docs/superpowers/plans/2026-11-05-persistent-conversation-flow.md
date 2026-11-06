# Persistent Conversation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist an employee conversation's active support flow and make ticket consultation an explicit, resumable selection flow.

**Architecture:** Add a validated flow snapshot to `Conversation`, loaded and transitioned by backend orchestration. Consultation engines receive the snapshot and emit a typed flow transition; the service persists it atomically with the agent message. The frontend posts a ticket identifier for selection, while the backend confirms ownership and restores the suspended flow after answering.

**Tech Stack:** NestJS, Prisma/SQLite, Zod, TypeScript, Next.js/React, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-persistent-conversation-flow-design.md`

## Global Constraints

- Keep authorization, ticket ownership validation, and flow transitions in the backend.
- Persist conversation state across browser reload and API restart.
- Keep draft confirmation/versioning and human-handoff pauses authoritative.
- Keep user-facing copy in Brazilian Portuguese and engineering artifacts in English.
- Use isolated databases for integration and browser tests.

## Review Focus

- An employee must never select another employee's ticket; cover this in the integration selection test.
- An explicit ticket consultation during a support case must restore the previous stage afterward; cover it in the flow service test.
- A reload before choosing a ticket must render the same ticket picker; cover it in the browser test.
- A concise fact such as `Windows 11` must update the active case rather than start a generic flow; cover it in the deterministic engine test.
- An analyst-owned or waiting conversation must remain paused regardless of its saved flow; cover it in the existing handoff service test.

### Task 1: Define and persist the flow snapshot

**Files:**
- Create: `packages/contracts/src/conversation-flow.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_conversation_flow/migration.sql`
- Modify: `apps/api/src/conversations/conversations.service.ts`
- Test: `apps/api/src/conversations/conversations.service.integration.test.ts`

**Interfaces:**
- Produces `ConversationFlowSchema`, `ConversationFlow`, and validated read/write methods on `ConversationsService`.
- Consumes the conversation owner and state version already used for agent-turn persistence.

- [ ] **Step 1: Write failing integration tests for a new conversation's empty flow and a saved support snapshot surviving a fresh service instance.**
- [ ] **Step 2: Run the focused integration test and verify it fails because the flow field and service API do not exist.**
- [ ] **Step 3: Add the strict Zod flow union, Prisma JSON/text field, migration, and server-owned read/write methods.**
- [ ] **Step 4: Run the focused integration test and verify it passes.**

### Task 2: Transition the active flow in deterministic consultation

**Files:**
- Modify: `apps/api/src/agent/consultation/types.ts`
- Modify: `apps/api/src/agent/consultation/fixture-consultation.ts`
- Test: `apps/api/src/agent/consultation/fixture-consultation.test.ts`

**Interfaces:**
- Consumes `ConversationFlow` in `ConsultationEngineRequest`.
- Produces a validated transition event consumed by `ConsultationService`.

- [ ] **Step 1: Write failing tests for fragmented support facts and an explicit ticket-consultation request that retains a suspended support flow.**
- [ ] **Step 2: Run the focused fixture tests and verify they fail under latest-message routing.**
- [ ] **Step 3: Implement flow-aware classification and stage transitions for support facts and ticket consultation.**
- [ ] **Step 4: Run the focused fixture tests and verify they pass.**

### Task 3: Persist transitions atomically with the agent turn

**Files:**
- Modify: `apps/api/src/consultation/consultation.service.ts`
- Modify: `apps/api/src/conversations/conversations.service.ts`
- Test: `apps/api/src/consultation/consultation.service.test.ts`
- Test: `apps/api/src/consultation/consultation.service.integration.test.ts`

**Interfaces:**
- Consumes the transition event from Task 2.
- Produces an agent turn and current flow in one transaction guarded by conversation state/version.

- [ ] **Step 1: Write failing service tests that assert a completed response persists its transition and a stale run persists neither message nor transition.**
- [ ] **Step 2: Run the focused service tests and verify they fail.**
- [ ] **Step 3: Extend guarded agent-turn persistence to save the parsed flow snapshot atomically.**
- [ ] **Step 4: Run the focused service tests and verify they pass.**

### Task 4: Select and resume a ticket consultation safely

**Files:**
- Modify: `apps/api/src/conversations/conversations.controller.ts`
- Modify: `apps/api/src/conversations/conversations.service.ts`
- Modify: `apps/web/src/features/consultation/consultation.tsx`
- Modify: `apps/web/src/features/consultation/ticket-selection.tsx`
- Test: `apps/api/src/conversations/conversations.service.integration.test.ts`
- Test: `apps/web/e2e/conversation-flow.spec.ts`

**Interfaces:**
- Consumes `ticketId` submitted for a `ticket_consultation` flow.
- Produces a server-validated selection and restored support snapshot after the ticket answer.

- [ ] **Step 1: Write failing integration and browser tests for opening the picker, selecting an owned ticket by identifier, rejecting another employee's ticket, and resuming the suspended support stage after reload.**
- [ ] **Step 2: Run the focused tests and verify they fail because selection is currently sent as title text.**
- [ ] **Step 3: Add the authenticated selection endpoint/message contract and update the picker to use it.**
- [ ] **Step 4: Run the focused integration and browser tests and verify they pass.**

### Task 5: Verify the full workflow

**Files:**
- Modify: `docs/employee-visual-verification.md`

- [ ] **Step 1: Run formatting, type checking, linting, unit tests, isolated integration tests, build, and browser tests.**
- [ ] **Step 2: Manually verify the Ana flow: VPN → fragmented facts → ticket consultation → ticket selection → resume support → draft confirmation.**
- [ ] **Step 3: Record executed evidence and any environment limitation in the verification document.**
