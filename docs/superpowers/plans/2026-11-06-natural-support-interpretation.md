# Natural support interpretation — issue #62

**Goal:** accept free-form employee reports and avoid collecting facts already
present in the current problem, while preserving server-owned ticket operations.

**Spec:** owner's approved sequence in this chat; PRD v5 pp.1–4, B02/B04/B07/B09–B16.
**Stack:** existing strict TypeScript, Mastra, Zod, NestJS and Prisma; no new provider.

## Design

The live `propose-ticket-draft` tool receives a typed interpretation of type,
category, impact, work state and urgency, each with an employee-message ID and
literal supporting quotation. The model interprets semantics, including negation,
corrections, and topic boundaries. The backend verifies citations against owned
employee messages in the server-provided run snapshot, after the declared current
problem start; it derives priority and executes existing duplicate/draft checks.
Citation validation proves provenance, not semantic truth. Quality is evaluated
with real multi-turn cases; prompts must ask about ambiguity rather than guess.

The model's create schema requires this interpretation. The internal deterministic
adapter retains its old explicit-answer path for existing fixture tests, never as
a fallback for missing interpretation from the live tool. Existing persisted text
history provides continuity; legacy regex-derived flow facts are not injected as
authoritative facts into the live prompt. This increment does not add a second
model call or rewrite response streaming. Title/description grounding, identity,
versioned confirmation, idempotency, duplicate prevention and human ownership stay
enforced outside the model.

## Tasks and evidence

- [x] Write failing integration tests: natural phrasing, negative same-day urgency,
  source provenance, foreign/agent/forged/before-boundary citations and unknown facts.
- [x] Add semantic proposal schema and a focused evidence validator; require it in
  live tools, preserve deterministic fixtures and compute priority on the server.
- [x] Give live model employee message IDs, require latest relevant facts, and add
  complete knowledge-success, failed-guidance, partial-information, correction,
  topic-change and consultation-interruption examples. Bump prompt version.
- [x] Extend deterministic browser/contract tests for wiring and run full check.
- [ ] Run real-provider browser cases: resolve without ticket; failed guidance with
  all facts supplied naturally; collect only one missing fact; negative urgency;
  changed problem and status interruption. Record actual failures and quota.
- [x] Review manually and update verification/context/acceptance.
- [ ] Integrate into main and deploy locally after required checks.

Ruling: the owner explicitly requested main integration after being told that the
real-provider gate is blocked by an invalid environment key. Integrate the tested
implementation while preserving the outstanding live criterion on issue #62;
do not claim the conversation-quality gate passed. Prior dependent PRs are merged.

## Review focus

- Quotations from a different employee, role or problem must not pass provenance.
- Missing live interpretation must not silently use phrase dictionaries.
- Negations and corrections require semantic evaluation, not word-triggered priority.
- A valid interpretation never authorizes a ticket write or resumes a paused agent.
- Browser CI fixtures prove wiring; only provider runs count as conversational evidence.
