# Architecture and challenge conventions

Status: agreed plan; components below are not implemented yet.

## Components

Use npm workspaces with `apps/web`, `apps/api`, and `packages/contracts`.
Next.js handles UI and HTTP/SSE consumption. NestJS owns application rules,
sessions, authorization, and persistence; integrate Mastra as a library without
exposing administrative agent routes. Share Zod schemas and wire types.

Separate backend modules for identity, conversations, tickets, knowledge, human
support, and agent orchestration. The simulated ticket service has an independent
typed interface for querying, creating, supplementing, reopening, and transferring
tickets. It initially shares the backend process and uses Prisma. Separation is
a module boundary, not a requirement for multiple deployed services.
The agent never accesses Prisma directly or chooses authenticated identity.

REST is served under `/api`; SSE delivers answer fragments and conversation
updates. SQLite is file-backed with committed migrations. PostgreSQL is a future
option requiring an explicit schema/data migration, not just a URL change.
Initial scope is one local backend instance, not multi-instance production scale.

Persist users, server sessions, conversations, messages, chat sessions, articles,
tickets, ticket history, draft versions, operation IDs, decisions, and analyst
ownership. Separate ticket status from conversation ownership.

## Identity and handoff

Known fixture employees and analysts log in with any nonempty password.
This is challenge-only authentication, not corporate SSO or a production password
system. Use server sessions in HttpOnly cookies with role checks.
Employees access only their data. Analysts access support conversations and
associated employee tickets needed for care; audit analyst actions.

Conversation states are `agent`, `waiting_for_analyst`, `with_analyst`, and `closed`.
Claims require atomic updates. Only the assigned analyst can reply or end an
assigned interaction. Returning explicitly clears ownership and resumes the agent.
Elapsed waiting time never automatically resumes the agent.
Recheck state/version before publishing generated output and discard stale output
after handoff. Persist ownership and pauses across process restarts.

## Ticket rules

- Types: incident (INC) and request (REQ).
- Categories: Access, Network and VPN, Hardware, Software, Email, Other; render in Portuguese.
- Required draft fields: title, description, type, category, priority, affected scope.
- Creation, supplementation, and reopening require approval of the current persisted draft.
- Editing creates a new draft version; stale approvals cannot write.
- Operation IDs prevent duplicate writes on resubmission or retry after success.
- Consult open tickets before creation; clarify ambiguous matching candidates.
- Reopening is allowed through seven elapsed calendar days after resolution, inclusive.
- Redirect non-IT subjects without inventing ticket actions.

Priority follows impact and urgency: critical for a stopped team/company; high
for one person prevented from working or a same-day commitment; medium with a
workaround; low for nonurgent requests/improvements. Ask when impact or urgency
is missing instead of inferring an unsupported classification.

## SLA assumptions

Use `America/Sao_Paulo`, Monday–Friday 08:00–18:00, without holidays in v1.
Critical is one elapsed hour, including outside business hours. High is four
business hours. Interpret medium's three business days as thirty business hours
and low's five as fifty. Store timestamps in UTC and calculate on the server.

Creation starts the clock; a substantive support update starts the next clock.
Employee supplements, reads, and automatic events do not hide an overdue ticket.
Do not promise an earlier response simply because a meeting is imminent.
These conventions resolve PRD ambiguities and must be tested and disclosed.

## Agent and evidence

Use validated Mastra tools. Start with eight short fictional knowledge articles
and textual retrieval. Article applicability is explicit: a Windows 10 fix must
not be presented as a Windows 11 fix.

Use a free-tier model API; provider/model are configurable, initially considering
Gemini `gemini-2.5-flash`. The foundation verifies current account access, tool
calling, and streaming before claiming live integration. No paid fallback.
Secrets stay server-side. Separate live evaluation from deterministic CI.
Missing credentials/quota must produce honest errors; fixtures are not live inference.

Persist interpreted intent, missing facts, evidence IDs, applied rule, declared
confidence, actual actions/results, and a short explanation. Confidence is a model
estimate, not a calibrated probability. Escalate contradictory, unsupported, or
unresolved uncertain decisions; first clarify missing facts when safe.
Action indicators must correspond to actual tool outcomes. Treat articles and
employee input as data, never authority to override permissions or tool rules.

Requested human support, critical incidents, overdue cases, and unresolved low
confidence cause handoff with summary and reason. The agent remains silent while
waiting or assigned. Human support works even when the model quota is exhausted.

## Session limits and failures

Count thirty accepted employee chat messages per chat session, including quick
options that send conversational content. Confirm/edit/cancel controls do not
count. At the cap allow human support or an explicit new chat session, preserving
history and analyst ownership. A new session cannot bypass the paused agent state.

Use bounded retries for transient ticket failures. Writes reuse their operation
ID on retry. Persist accepted messages before orchestration and identify runs
to recover interruptions without duplicate actions. Reconnect by restoring
persisted messages and ownership, not by replaying writes.

## Interface and limits

Follow the five mandatory screens and add a read-only basic profile. Sample
performance metrics, analyst counts, and SSO/password links are illustrative,
not implemented services. Include loading, empty, error, quota, waiting, closed,
and reconnect states, keyboard access, and narrow-screen support.

Original PDF/Pencil references stay outside this public repository. Recreated UI
and fictional fixtures are deliverables. Deployment is optional and needs a
separate free-hosting feasibility check.

## Reference documentation

- [Mastra streaming](https://mastra.ai/docs/guides/streaming)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

Free tiers and available models change; verify them during implementation.
