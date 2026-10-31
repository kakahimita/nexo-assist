# Nexo Assist

An IT service desk assistant for knowledge retrieval, ticket consultation,
confirmed ticket changes, and human handoff with context.

## Current status

**Planning and repository setup. Application implementation has not started.**
There are no runnable application commands or deployed services yet.
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

- [Architecture and challenge conventions](docs/architecture.md)
- [Roadmap and acceptance criteria](docs/roadmap.md)
- [Development workflow](docs/development-workflow.md)
- [Contributor instructions](AGENTS.md)

Overall objective: [issue #1](https://github.com/kakahimita/nexo-assist/issues/1).
Runnable foundation: [issue #3](https://github.com/kakahimita/nexo-assist/issues/3).

## Setup and model access

The foundation delivery will add setup commands, supported runtime versions,
and `.env.example`. Model access requires a server-side API key. Exhausted
free quotas must cause a clear recoverable error, not paid inference.
Automated checks will run without real model credentials.

Only fictional service desk fixtures will be used. Original challenge documents
and design files are external references, not published repository assets.
No production authentication or deployment is claimed at this stage.
