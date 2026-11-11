# Nexo Assist

An IT service desk assistant for knowledge retrieval, ticket consultation,
confirmed ticket changes, and human handoff with context.

## Current status

**The employee chat, confirmed ticket changes, and human support console are
available.** Demo login, employee-isolated history, ticket consultation, and
confirmed ticket changes use SQLite. The agent streams consultation answers and
decision evidence, proposes confirmable ticket drafts, enforces the
thirty-message session cap, and shows an accessible thinking state and
cause-specific error notifications. Human handoff creates a durable waiting
conversation with context; analysts can claim it, reply, return it to the agent,
or close it. The employee dashboard lists only the signed-in employee's
conversations and connected tickets, and the login shows persisted service
indicators.

Visual fidelity is partial: the main loading, empty, error, waiting, and closed
states exist, but the original Pencil frames are not reproduced pixel for pixel
and reconnect coverage remains open under #9. Live-model reliability remains under evaluation: the six consultation
scenarios passed on their corrected run, while the four free-tier draft
scenarios do not all pass. Production authentication, password recovery, remote
access, and deployment are not delivered services.
The project is built collaboratively in small, reviewable deliveries so the
developer can understand, explain, and modify the implementation.

## Stack

- Strict TypeScript and npm workspaces.
- Next.js, React, and CSS for employee and analyst interfaces.
- NestJS for rules, sessions, authorization, and persistence.
- Mastra for agent orchestration and validated tools.
- Prisma with file-backed SQLite for the initial local application.
- Free-tier model API with configurable provider/model and no paid fallback.
- `packages/contracts` for shared Zod schemas and wire types.

## Principles

Backend rules enforce permissions, confirmation, SLA, and ownership independently
of the model. Conversations, drafts, decisions, and human ownership survive
restarts. Decision explanations refer to actual tool outcomes and evidence.
The agent stays paused while a conversation waits for or receives human care.

## Architecture

The web app in `apps/web` renders the employee chat, conversations dashboard,
analyst console, login, and diagnostics. It reaches the NestJS API in `apps/api`
through a same-origin proxy; the API owns sessions, authorization, business
rules, and persistence.

The Mastra agent runs as a library inside the API. It receives a server-resolved
employee identity, uses read-only knowledge and ticket tools, and returns typed
events. The ticket service stays behind a typed interface, and
`packages/contracts` shares Zod schemas and wire types between web and API.

Prisma persists conversations, messages, drafts, decisions, tickets, and human
ownership in file-backed SQLite with committed migrations. Confirmation,
idempotency, duplicate checks, SLA calculation, and ownership checks happen in
the backend, outside the model. See [architecture and challenge
conventions](docs/architecture.md).

## Trade-offs and limits

- Demo authentication accepts any nonempty password for fictional identities;
  there is no corporate SSO.
- SQLite keeps local setup small and restart-safe but is not a production
  multi-tenant database.
- The model provider is free-tier and has no automatic paid fallback; quota or
  provider failures surface as errors.
- Deterministic fixture responses make CI repeatable; they are not live-model
  evidence.
- Prototype fidelity is partial, and native Pencil exports are unavailable for
  exact pixel comparison.
- The private challenge reference bundle is unavailable in this checkout; the
  tracked hashes document its expected assets.
- Analyst replies do not currently reset the ticket deadline; the architecture
  convention for a substantive support update remains future work.
- Password recovery, remote access, and deployment are not delivered; deployment
  is optional in the challenge.

## Requirements checklist

[Submission requirements checklist](docs/submission-checklist.md) maps B01–B18
and V01–V06 to executed evidence and lists the remaining gaps.

## Documentation

- [Challenge context and source authority](docs/challenge-context.md)
- [Challenge acceptance and test matrix](docs/challenge-acceptance.md)
- [Submission requirements checklist](docs/submission-checklist.md)
- [Local original references and restoration](docs/challenge-references.md)
- [Architecture and challenge conventions](docs/architecture.md)
- [Roadmap and acceptance criteria](docs/roadmap.md)
- [Development workflow](docs/development-workflow.md)
- [Contributor instructions](AGENTS.md)

Verification records:

- [Foundation verification](docs/foundation-verification.md)
- [Identity and history verification](docs/identity-history-verification.md)
- [Ticket-service verification](docs/ticket-verification.md)
- [Ticket consultation verification](docs/ticket-consultation-verification.md)
- [Agent consultation verification](docs/agent-consultation-verification.md)
- [Natural support verification](docs/natural-support-verification.md)
- [Conversational drafts verification](docs/conversational-drafts-verification.md)
- [Autonomous resolution verification](docs/autonomous-resolution-verification.md)
- [Human handoff verification](docs/human-handoff-verification.md)
- [Human support verification](docs/human-support-verification.md)
- [Session limit verification](docs/session-limit-verification.md)
- [Login viewport verification](docs/login-viewport-verification.md)
- [Service metrics verification](docs/service-metrics-verification.md)
- [Employee visual verification](docs/employee-visual-verification.md)
- [Thinking indicator verification](docs/thinking-indicator-verification.md)
- [Chat error notifications verification](docs/chat-error-notifications-verification.md)

Overall objective: [issue #1](https://github.com/kakahimita/nexo-assist/issues/1).
Runnable foundation: [issue #3](https://github.com/kakahimita/nexo-assist/issues/3).

## Setup and model access

Install Node.js 22.23.2 and npm 10.9.8, then run from the repository root:

```sh
npm ci
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell,
`cp .env.example .env` in POSIX shells), then:

```sh
npm run db:init
npm run dev
```

Open http://localhost:3000; the API is at http://localhost:3001/api.
The diagnostic page is at http://localhost:3000/diagnostico. Sign in using
`ana.souza@nexo.com.br`, `bruno.lima@nexo.com.br`, or
`analista@nexo.com.br` with any nonempty password. This is fictional demo
authentication, not corporate login. Employees can create a conversation,
send messages, receive streamed consultation responses and recover their history.
Employees can also consult fictional tickets and review, edit, confirm or cancel
a draft for ticket creation, supplementation and recent reopening. Example
tickets are seeded for Ana and Bruno; the seed does not overwrite existing data.
Employees start or resume a conversation in **Atendimento**, review their own
history in **Minhas conversas**, and start a **Nova conversa** when no human
owns the current conversation. Signing in as `analista@nexo.com.br` opens the
analyst console, where a waiting conversation can be claimed, answered, returned
to the agent, or closed. While a conversation waits for or is owned by an
analyst, the agent stays paused until it is returned. Use **Sair** to revoke a
session.
`DATABASE_URL` defaults to `data/nexo.db` relative to the repository root.
`db:init` applies committed migrations without resetting existing data;
use `npm run db:migrate:dev` when developing a migration. Integration and
browser checks use temporary databases, separate from the development file.

The backend computes priority and deadlines in `America/Sao_Paulo`: critical
uses one elapsed hour; high, medium and low use 4, 30 and 50 business hours,
Monday–Friday 08:00–18:00 without holidays. The clock starts at creation.
Employee supplements and reads do not reset it; reopening a resolved ticket
starts a new clock, while analyst replies do not reset it yet. Resolved tickets
can reopen through seven elapsed days.

The server stores each draft version and operation ID; repeating a confirmation
returns the committed result instead of creating another write. Temporary
service failures have bounded retries. Duplicate prevention combines exact
normalized-title matching with a deterministic possible-candidate search over
meaningful title and description terms, then asks the employee to select or
confirm before writing; it can still miss the same issue described very
differently, and representative paraphrases are tested separately.
Handoff creates a durable waiting conversation with context and pauses the agent.
The analyst queue lists waiting and owned conversations. Claiming moves the
linked active ticket to `Em andamento`; returning keeps it active; closing
resolves an incident and requires an approve-or-conclude outcome for a request.

For deterministic verification, install Chromium with
`npm exec playwright -- install chromium`, then run `npm run check`. Individual
commands are `npm run typecheck`, `npm run lint`, `npm test`,
`npm run test:integration`, `npm run build`, and `npm run test:e2e`.
Run `npm run build` and `npm start` for the production build locally.

The consultation backend uses Mastra with the configured Google model by default.
It resolves employee identity on the server and exposes read-only ticket and knowledge
search tools; action labels and evidence are derived from tool results. Decision
confidence is an estimate. Platform-specific knowledge is classified before use.
`CONSULTATION_ENGINE=fixture` selects a deterministic test engine; it is not live
model evidence and is intended only for tests. The chat implements conversational
ticket drafts (create, supplement and recent reopen) and the thirty-message
session cap. Human handoff, the analyst queue, claim, reply, return, and close are
implemented; live handoff reliability and exact prototype fidelity remain under
evaluation.

`npm run smoke:consultation` separately exercises the production engine with an
isolated temporary database. It requires a local `GOOGLE_API_KEY`, records model,
prompt version, latency, available usage, decision, actions and evidence, and
fails when its assertions fail. No paid fallback is configured. The six
consultation scenarios passed on their corrected run; the four draft scenarios
do not all pass. See [consultation verification](docs/agent-consultation-verification.md)
and [conversational drafts verification](docs/conversational-drafts-verification.md).

The optional `npm run smoke:model` explicitly contacts Google using the
server-only `GOOGLE_API_KEY` in `.env`. Configure a project with free-tier
access and check the provider's current quota and pricing first. A missing key,
quota exhaustion, or unavailable model produces an error; there is no automatic
fallback. Never share the key in chat or commit it. CI does not need a key.
See [foundation verification](docs/foundation-verification.md) and
[ticket-service verification](docs/ticket-verification.md) for completed and
outstanding checks.

Only fictional service desk fixtures will be used. The original challenge
references are private and excluded from Git; restore them locally as described
in the [reference policy](docs/challenge-references.md).
