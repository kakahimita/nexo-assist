# Identity and Persistent History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Review is manual under AGENTS.md unless the owner explicitly requests delegation.

**Goal:** Let fictional employees and analysts sign in and restore authorized conversation history after an application restart.

**Architecture:** NestJS owns identities, opaque persisted sessions and conversation access; Prisma stores users, sessions, conversations and messages. Next.js provides a minimal login and history interface through a same-origin API proxy; shared Zod contracts validate inputs and responses. This increment persists employee messages without pretending an agent or analyst workflow exists.

**Tech Stack:** Node 22.23.2, npm workspaces, strict TypeScript, Next.js, NestJS, Prisma/SQLite, Zod, Vitest, Supertest and Playwright.

**Spec:** `docs/challenge-context.md`, `docs/challenge-acceptance.md` (B01, B13, B16, V01), `docs/architecture.md`, and GitHub issue #4. The PRD pages 1–2 and 4–5 and original Pencil frame `bi8Au` remain authoritative; verify private asset hashes before visual work.

## Global Constraints

- Engineering artifacts use English; user-facing copy and explanations use Brazilian Portuguese.
- Known fictional identities accept any nonempty password; reject unknown identities. This is demo authentication, not corporate SSO.
- Authenticated identity comes from the server; enforce authorization and database access in the backend.
- Persist conversations, messages and server sessions; isolate employee data and restrict analyst access to support context.
- Use HttpOnly cookies, validated HTTP inputs and shared contracts; no real model key is required in CI.
- Do not claim an agent response, human support workflow, password recovery, SSO, or fabricated live metrics in this increment.
- Follow `apps/web/AGENTS.md` and read the installed Next.js documentation for routing/proxy behavior before implementing web changes.
- Source images are private; keep app screenshots separate and report native Pencil export limitations.

## Review Focus

1. Forged employee or role in a request cannot change server identity (Task 3).
2. An expired, revoked or malformed cookie cannot access history (Task 2).
3. Another employee's conversation ID cannot reveal messages or accept writes (Task 3).
4. Restart with the same database restores history and session without duplicating messages (Task 3).
5. Failed login or unavailable API presents accessible feedback without creating a session (Task 4).

## File Map

- `apps/api/prisma/schema.prisma` and a new migration: users, sessions, conversations and messages.
- `apps/api/src/identity/fixtures.ts`: stable fictional employee and analyst identities, seeded idempotently during database initialization.
- `packages/contracts/src/identity.ts`, `conversation.ts`, and `index.ts`: validated request/response wire contracts.
- `apps/api/src/identity/`: session service, cookie parsing, guard, controller and module.
- `apps/api/src/conversations/`: authorized history service, controller and module.
- `apps/api/src/app.ts`, `app.module.ts`, and `database/initialize.ts`: connect initialization and modules.
- `apps/api/test/identity.integration.test.ts`, `conversations.integration.test.ts`: isolated database and HTTP verification.
- `apps/web/src/app/`, `apps/web/src/features/identity/`, `apps/web/src/features/history/`: login, proxy and minimal history.
- `apps/web/e2e/identity-history.spec.ts`: browser login, isolation, error and restart workflow.
- `README.md`, `docs/challenge-acceptance.md`, `docs/roadmap.md`: usage and evidence tied to the actual revision, with unimplemented scope explicit.

### Task 1: Persist fictional identities and define wire contracts

**Files:** Modify `apps/api/prisma/schema.prisma`, `apps/api/src/database/initialize.ts`, `packages/contracts/src/index.ts`; create migration, `apps/api/src/identity/fixtures.ts`, `packages/contracts/src/identity.ts`, `packages/contracts/src/conversation.ts`; test `apps/api/test/database.integration.test.ts` and new `packages/contracts/src/identity.test.ts`, `conversation.test.ts`.

**Interfaces:** Produce `LoginInput { email: string; password: string }`, `UserView { id: string; name: string; email: string; role: 'employee' | 'analyst' }`, `ConversationView { id: string; createdAt: string }`, `MessageView { id: string; content: string; createdAt: string }`, and Zod schemas with matching names suffixed `Schema`. Conversation creation takes no identity; message input is `{ content: string }` with nonblank content, maximum 4000 characters.

- [ ] Write failing contract tests: reject unknown fields, malformed email, empty password, blank or over-4000-character content; accept a valid fictional login and ISO timestamps. Write a database integration test that initializes twice and finds exactly two employees and one analyst with stable unique emails.
- [ ] Run `npm test` and `npm run test:integration`; expect failures for missing contracts and seed data.
- [ ] Add Prisma `User` (unique normalized email, name, role), `Session` (unique token hash, user relation, expiry), `Conversation` (employee owner and creation time), and `Message` (conversation relation, content and creation time); add migration. Seed `ana.souza@nexo.com.br`, `bruno.lima@nexo.com.br` as employees and `analista@nexo.com.br` as analyst via idempotent upserts. Do not seed passwords.
- [ ] Implement schemas and exports; normalize email by trim and lower-case before fixture lookup, retain arbitrary nonempty password semantics.
- [ ] Run `npm test` and `npm run test:integration`; expect all passing. Commit with `feat: add identity and history persistence`.

### Task 2: Implement server-owned sessions

**Files:** Create `apps/api/src/identity/identity.service.ts`, `identity.controller.ts`, `identity.guard.ts`, `identity.module.ts`, `apps/api/test/identity.integration.test.ts`; modify `apps/api/src/app.module.ts` and contracts as necessary.

**Interfaces:** Produce `IdentityService.login(input: LoginInput): Promise<{ user: UserView; token: string }>`; `IdentityService.resolve(token: string): Promise<UserView | null>`; `IdentityService.logout(token: string): Promise<void>`. HTTP: `POST /api/session` returns `UserView`, `GET /api/session` returns `UserView`, `DELETE /api/session` returns 204. Guard resolves identity from cookie, not body or query.

- [ ] Write failing B01 integration tests: known employee and analyst log in with arbitrary nonempty passwords; unknown identity and empty password fail; cookie has `HttpOnly`, `SameSite=Lax`, `Path=/`, no token in JSON; malformed, expired and revoked tokens return 401; logout invalidates server record. Assert invalid bodies return 400.
- [ ] Run `npm run test:integration`; expect failures for missing routes.
- [ ] Implement a cryptographically random 32-byte opaque token, persist only its SHA-256 hash with 24-hour expiry, set cookie `nexo_session` with matching max age and HttpOnly/SameSite=Lax/Path=/; set Secure in HTTPS deployment. Reject malformed tokens before lookup. Clear cookie on logout; never log password or token.
- [ ] Run `npm run test:integration`; expect all passing. Commit with `feat: add demo identity sessions`.

### Task 3: Isolated persistent conversation history

**Files:** Create `apps/api/src/conversations/conversations.service.ts`, `conversations.controller.ts`, `conversations.module.ts`, `apps/api/test/conversations.integration.test.ts`; modify `apps/api/src/app.module.ts`.

**Interfaces:** With guard-provided `UserView`, implement `list(user): Promise<ConversationView[]>`, `create(user): Promise<ConversationView>`, `messages(user, conversationId: string): Promise<MessageView[]>`, `append(user, conversationId: string, content: string): Promise<MessageView>`. Expose employee-only `GET/POST /api/conversations` and `GET/POST /api/conversations/:id/messages`; return 404 for inaccessible or nonexistent IDs, 403 for analyst use of employee endpoints, 400 for invalid inputs.

- [ ] Write failing B01/B13/B16 HTTP tests: Ana creates a conversation and message, Bruno's list excludes it and direct reads/writes return 404; supplied owner or role fields are rejected; analyst receives 403; unauthenticated requests return 401. Check messages return deterministic creation order and invalid content is rejected.
- [ ] Add a restart test: close Nest app, reopen with the same isolated migrated database and cookie, assert one conversation and exactly one original message are restored; database cleanup occurs only after both apps close.
- [ ] Run `npm run test:integration`; expect missing-route failures.
- [ ] Implement ownership-scoped database queries, deriving owner exclusively from the guard; validate strict schemas and use a stable ordering by creation time and ID. Do not produce agent messages or provide analyst access to unrelated employee history.
- [ ] Run `npm run test:integration`; expect all passing. Commit with `feat: persist isolated conversation history`.

### Task 4: Usable login and history

**Files:** Create `apps/web/src/app/api/[...path]/route.ts`, `apps/web/src/features/identity/login.tsx`, `apps/web/src/features/history/history.tsx`, `apps/web/e2e/identity-history.spec.ts`; modify `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`, and web test setup as needed.

**Interfaces:** Same-origin `/api/*` route forwards the allowed session and conversation endpoints to the configured backend, preserves status, content type and `Set-Cookie`, and forwards cookies without exposing a token to JavaScript. Login and history use the shared contracts; unauthorized responses return to login.

- [ ] Write failing B01/B13/V01 browser tests: keyboard login as Ana, visible Portuguese error for unknown identity and unavailable API, create a conversation and message, reload and see the message, log out and reject protected access; log in as Bruno and confirm Ana's content is absent. Add a backend restart/reload test using the isolated browser database and process harness.
- [ ] Run `npm run test:e2e`; expect failures for the missing flow.
- [ ] Implement accessible labels, keyboard submission, loading/error/empty states and a minimal history composer. Follow login frame `bi8Au` composition at 1440×900 and adapt to narrow screens; explain fixture login in Portuguese. Avoid unsupported prototype links and fabricated metrics. Read the Next.js route-handler documentation before implementing the proxy, restrict its destination and accepted paths, and preserve cookie attributes.
- [ ] Run `npm run test:e2e`; expect all passing. Compare app screenshots at the specified viewport with verified private references and `.pen` geometry; record renderer and the native-export limitation separately. Commit with `feat: add demo login and history interface`.

### Task 5: Verify and document the delivery

**Files:** Modify `README.md`, `docs/challenge-acceptance.md`, `docs/roadmap.md`; record evidence in `docs/identity-history-verification.md`.

**Interfaces:** Consumes Tasks 1–4; produces a reproducible walkthrough, evidence tied to tested revision, and explicit remaining limitations.

- [ ] Update setup with the three fictional emails, arbitrary nonempty password, login/logout and history walkthrough; state that the composer persists messages without generating replies and that authentication is for demonstration only.
- [ ] Run `npm run check` after installing Chromium; expect typecheck, lint, unit, integration, build and browser checks to pass. Record exact revision, commands and outcomes; report any failure or skip rather than claiming completion. Run `npm run smoke:model` only if an existing local key is available, without exposing it.
- [ ] Manually inspect the complete diff for session security, authorization, source provenance, accessibility and misleading claims; run `git diff --check`. Update acceptance and roadmap status only for demonstrated B/V portions, distinguishing planned from executed checks.
- [ ] Commit with `docs: record identity and history verification`. Prepare the issue-linked PR and manual review under `docs/development-workflow.md`; do not merge without explicit owner instruction.
