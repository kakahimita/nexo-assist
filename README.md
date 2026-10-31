# Nexo Assist

An IT service desk assistant for knowledge retrieval, ticket consultation,
confirmed ticket changes, and human handoff with context.

## Current status

**Foundation in progress.** A diagnostic web page, API health endpoints,
SQLite migrations, and an isolated model smoke command are available. The
service desk workflows and production authentication are not yet implemented.
The project is built collaboratively in small, reviewable deliveries so the
developer can understand, explain, and modify the implementation.

## Planned stack

- Strict TypeScript and npm workspaces.
- Next.js, React, and Tailwind for employee and analyst interfaces.
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
`DATABASE_URL` defaults to `data/nexo.db` relative to the repository root.
`db:init` applies committed migrations without resetting existing data;
use `npm run db:migrate:dev` when developing a migration. Integration and
browser checks use temporary databases, separate from the development file.

For deterministic verification, install Chromium with
`npm exec playwright -- install chromium`, then run `npm run check`. Individual
commands are `npm run typecheck`, `npm run lint`, `npm test`,
`npm run test:integration`, `npm run build`, and `npm run test:e2e`.
Run `npm run build` and `npm start` for the production build locally.

The optional `npm run smoke:model` explicitly contacts Google using the
server-only `GOOGLE_API_KEY` in `.env`. Configure a project with free-tier
access and check the provider's current quota and pricing first. A missing key,
quota exhaustion, or unavailable model produces an error; there is no automatic
fallback. Never share the key in chat or commit it. CI does not need a key.
See [verification evidence](docs/foundation-verification.md) for completed and
outstanding checks.

Only fictional service desk fixtures will be used. The original challenge
references are private and excluded from Git; restore them locally as described
in the [reference policy](docs/challenge-references.md).
