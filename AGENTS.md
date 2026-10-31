# Nexo Assist contributor instructions

The owner is learning. Explain the purpose of each change and keep deliveries
small enough to understand and modify live. Engineering artifacts use English;
user-facing copy and explanations use Brazilian Portuguese. PRs use English
except the `## Como testar` section, which uses Brazilian Portuguese.

## Workflow

Read `docs/development-workflow.md` before implementation or PR preparation.
Follow `docs/roadmap.md` and the agreed rules in `docs/architecture.md`.
Every delivery needs a real GitHub issue before editing delivery files.
Derive the branch from its issue: #12 becomes `feature/LAB-0012`.
Never invent LAB numbers, commit delivery changes to `main`, or merge without
explicit owner instruction. Read-only investigation needs no issue.

## Boundaries

- Use npm workspaces, strict TypeScript, and Next.js/NestJS/Mastra.
- Keep business rules, authorization, and database access in the backend.
- Keep the ticket service independent of agent code behind a typed interface.
- Authenticated identity comes from the server, never model arguments.
- Enforce current-draft confirmation and operation idempotency outside the model.
- Persist human ownership and check it before publishing generated responses.
- Validate HTTP and tool inputs; share schemas/wire types through contracts.
- Do not add automatic paid fallback or require real model keys in CI.
- Never commit secrets, databases, or original challenge documents.

## Verification

Current delivery is documentation only: check links, issue references, ignore
rules, and `git diff --check`. Do not invent passing application tests.
The foundation must add documented install, typecheck, lint, test, build, and
isolated database commands, then update these instructions.
Later deliveries run relevant checks and disclose failures and skipped checks.
Test behavior and trust boundaries rather than trivial implementation details.
Review manually unless the user or applicable instructions request delegation.
