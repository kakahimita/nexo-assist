# Nexo Assist

An IT service desk assistant for knowledge retrieval, ticket consultation,
confirmed ticket changes, and human handoff with context.

## Current status

**Identity, history, an initial ticket service, and an agent consultation path are available.** Demo login, employee-isolated history, ticket consultation and confirmed ticket changes use SQLite. The agent consultation streams read-only answers and decision evidence; live-model behavior remains unverified until the separate evaluation passes. Human support workflows and production authentication are not yet implemented.
The project is built collaboratively in small, reviewable deliveries so the
developer can understand, explain, and modify the implementation.

## Planned stack

- Strict TypeScript and npm workspaces.
- Next.js, React, and CSS for employee and analyst interfaces.
- NestJS for rules, sessions, authorization, and persistence.
- Mastra for agent orchestration and validated tools.
- Prisma with file-backed SQLite for the initial local application.
- Free-tier model API with configurable provider/model and no paid fallback.

## Principles

Backend rules enforce permissions, confirmation, SLA, and ownership independently
of the model. Conversations, drafts, decisions, and human ownership survive
restarts. Decision explanations refer to actual tool outcomes and evidence.
The agent stays paused while a conversation waits for or receives human care.

## Documentation

- [Challenge context and source authority](docs/challenge-context.md)
- [Challenge acceptance and test matrix](docs/challenge-acceptance.md)
- [Local original references and restoration](docs/challenge-references.md)
- [Architecture and challenge conventions](docs/architecture.md)
- [Roadmap and acceptance criteria](docs/roadmap.md)
- [Ticket-service verification](docs/ticket-verification.md)
- [Agent consultation verification](docs/agent-consultation-verification.md)
- [Development workflow](docs/development-workflow.md)
- [Contributor instructions](AGENTS.md)

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
Analyst support workflows are planned separately. Use **Sair** to revoke a session.
`DATABASE_URL` defaults to `data/nexo.db` relative to the repository root.
`db:init` applies committed migrations without resetting existing data;
use `npm run db:migrate:dev` when developing a migration. Integration and
browser checks use temporary databases, separate from the development file.

The backend computes priority and deadlines in `America/Sao_Paulo`: critical
uses one elapsed hour; high, medium and low use 4, 30 and 50 business hours,
Monday–Friday 08:00–18:00 without holidays. Employee supplements do not reset
the clock. A substantive support update must reset it when that workflow is
implemented in #8. Resolved tickets can reopen through seven elapsed days.

The server stores each draft version and operation ID; repeating a confirmation
returns the committed result instead of creating another write. Temporary
service failures have bounded retries. Exact normalized-title matching blocks
some duplicates, but can miss the same issue described differently and can
block different issues with the same title; broader matching is future work.
The backend can record a ticket transfer request, but this does not create an
analyst queue or indicate that a human has received the conversation.

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
model evidence and is intended only for tests. The chat does not yet implement
conversational writes, the session cap, or human handoff.

`npm run smoke:consultation` separately exercises the production engine with an
isolated temporary database. It requires a local `GOOGLE_API_KEY`, records model,
prompt version, latency, available usage, decision, actions and evidence, and
fails when its assertions fail. No paid fallback is configured. The live gate
has not been run for this increment; see [consultation verification](docs/agent-consultation-verification.md).

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
