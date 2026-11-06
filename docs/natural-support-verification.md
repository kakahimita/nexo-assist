# Natural support interpretation — issue #62

## Scope and provenance

The owner approved correcting natural-language interpretation, adding complete
support examples, and validating multi-turn resolution/handoff with a real model.
Sources: original PRD v5 pp.1–4 (B02/B04/B07/B09–B16), preserved reference bundle
with hashes verified on 2026-11-06. Original Annex A page 4 was visually inspected.
This increment builds on the merged #60 layout delivery; it does not change UI
layout, articles, provider, automatic billing behavior or the ticket service API.
[Plan](superpowers/plans/2026-11-06-natural-support-interpretation.md).

## Behavior and boundaries

Live create proposals now require typed semantic type/category/impact/work-state/
urgency facts, each linked to an exact quotation and employee-message ID. A
declared current-problem start bounds the source messages. The backend validates
owned conversation, employee role, quote provenance and the server-provided run
snapshot. It computes priority and retains existing duplicate checks, versioned
confirmation, idempotency and persisted human ownership. A proposal remains a
draft; it cannot itself create a ticket.

The model interprets meaning, including negations, corrections, interruption and
problem changes. Provenance validation is not proof of semantic truth: a real
model can still choose the wrong interpretation or problem boundary. It must ask
about missing or ambiguous facts. Real multi-turn evidence is recorded separately
below; deterministic tests cannot establish conversational quality.

Persisted conversation text provides continuity. The live prompt no longer
receives regex-derived legacy flow facts as authoritative support context. The
internal deterministic adapter retains explicit-answer parsing for pre-existing
fixtures; missing live interpretation is rejected instead of falling back to it.
The source quotation requirement for title/description remains in place. There
is no additional per-turn model call or response-stream rewrite in this increment.

Prompt `consultation-v8` adds complete knowledge-success, failed-guidance,
single-missing-fact, correction, topic-change, consultation-interruption and
critical-transfer examples. It requests only unknown facts and distinguishes a
negative same-day statement from an urgent commitment.

## Executed checks

The new integration test failed before implementation because the old proposal
schema rejected semantic interpretation. It then passed: a free-form projector
report produced a medium-priority draft, while forged quotations, agent messages,
foreign IDs, unknown facts and citations before the new problem were rejected.
Ticket count did not change on proposal. Targeted unit checks also passed.

A controlled browser fixture supplies prewritten semantic facts through the
actual model-tool adapter. It tests wiring, draft display/confirmation and human
continuation; it does not simulate or prove semantic inference. An initial browser
assertion selected only the priority word rather than its full rendered label;
the selector was corrected to `Prioridade: Média`.

`npm run check` passed: typecheck, lint, formatting, 183 unit tests, 65 integration
tests, production build and 84 Chromium tests using isolated databases. The final
expanded provenance integration check also passed separately, including evidence
from a real different employee conversation. Local logs are under `outputs/`
and excluded from Git.

## Live provider gate

Preflight `npm run smoke:model` was executed and failed: the configured environment
key was rejected with HTTP 401 / invalid API key, not a quota 429. The owner was
informed and asked to configure a replacement free-tier key through the login at
http://localhost:3210. That web/API instance uses an isolated temporary database
and the real Mastra engine. No key is requested in chat or committed to source.
Live multi-turn checks are pending that credential; they are not claimed passed.

## Integration decision

After this pending real-provider gate was disclosed, the owner explicitly requested
integrating this correction into main. The PR references #62 without closing it;
real multi-turn acceptance remains outstanding after merge. Manual review covered
the live-only semantic schema, run snapshot, employee-owned quotations, no-write
draft proposals, deterministic priority, unchanged confirmation/idempotency and
human-ownership guards. No outstanding implementation findings were identified;
the semantic-quality limitation above remains material and disclosed.
