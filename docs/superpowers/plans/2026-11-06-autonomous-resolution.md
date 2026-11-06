# Autonomous resolution correction — issue #52

**Goal:** Resolve employee IT issues with applicable knowledge before preparing a confirmed ticket and human continuation when needed.

**Sources:** Owner request (2026-11-06), PRD v5 pp. 1–2/4, original Pencil frames `x2HBOE` and `CAqx8`. All 19 reference hashes verified. Prototype examples are illustrative; confirmation, privacy and durable pause follow the PRD.

**Architecture:** Keep Mastra as the live reasoning engine and NestJS as the authority for identity, facts, confirmation and handoff. Improve the support instructions and supply the persisted support context; remove the opening-command prerequisite from grounded draft validation. Conversational drafts that require analyst continuation must be explicitly marked in the tool input and durably associated with their conversation, then transferred after confirmation, never before it.

**Workspace:** Reuse the clean linked checkout originally named LAB-0046, now `feature/LAB-0052`, advanced to the existing #50 base (`a60bfa1`) while preserving the delivery edits. Fetching origin subsequently confirmed that #50 is merged into main. Initially web on 3100 used the #50 checkout and forwarded to an older API on 3001; the corrected web and API now both use this checkout, with an explicit 3100 → 3101 proxy. Preserve the demonstration database and unrelated services.

## Implementation and verification

- [x] Regression tests: natural initial report and explicit answers yield grounded draft facts without an opening command; unknown/negated facts do not produce classifications; new explicit requests clear previous facts.
- [x] Integration: unresolved support creates only a pending draft, confirmation creates one ticket and queues the conversation with history, retry does not transfer twice, cancel/stale/other-owner confirmation does not queue.
- [x] Improve live support instructions: search applicable knowledge for all IT problems, retain context, ask only missing facts, verify whether guidance worked, do not repeat failed guidance, proactively prepare a draft when safe resolution is exhausted.
- [x] Bound live generation and preserve explicit quota failures. Keep human support available without model access.
- [x] Run targeted red/green tests, then format and `npm run check`; run model smoke separately and disclose quota limits.
- [x] Browser live employee diagnosis, failed guidance, draft review/confirmation, analyst claim/reply and paused-agent check. Use isolated databases for automated checks.
- [x] Review the final diff manually and record executed evidence separately from planned checks.

## Review focus

Do not infer urgency from the word “hoje” inside a denial; do not create a ticket when guidance worked; do not reuse old facts for a different request; do not replay handoff after analyst return; do not claim a successful tool operation without its result.
