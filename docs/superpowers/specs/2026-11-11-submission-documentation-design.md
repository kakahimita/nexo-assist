# Submission documentation and README design

**Issue:** #10

**Branch:** `feature/LAB-0010`

**Status:** Awaiting owner approval.

## Intent

The implementation and its verification records are ahead of the submission
entry points. The README still says human support and the analyst queue are not
implemented, two documents still describe PR #67 as pending, and there is no
single place that maps the challenge requirements to their evidence. A reviewer
or interviewer can reach a false conclusion before finding the verification
documents.

## Goals

- Make the README truthfully describe the delivered employee and analyst flows.
- Add a concise architecture overview and the main trade-offs and limits.
- Add `docs/submission-checklist.md`: requirement, status, evidence link, and
  remaining gap for B01–B18, V01–V06, and the submission-specific gates.
- Correct statements that a merged delivery has made false.
- Link the newer verification documents from the README.
- Record the #65/#68 merge in the roadmap and context.

## Non-goals

- No application behavior, contracts, migrations, or tests change.
- No new live-model evaluation, demo script, interview script, deployment, or
  visual acceptance. Those remain later #10 work.
- No rewriting of historical verification narratives. Only claims contradicted
  by a merged delivery are corrected.
- No original challenge assets or private reference paths are added.
- No change to the acceptance matrix's requirement definitions.

## Approach chosen

A separate `docs/submission-checklist.md` linked from the README. The README
stays a short entry point, while the checklist carries the row-by-row acceptance
status and evidence links.

Alternatives rejected:

- A checklist inside the README makes setup, architecture, limits, and a 24-row
  table compete for the same short document.
- Extending `docs/challenge-acceptance.md` mixes the immutable requirement
  definitions with the changing delivery status and makes the matrix longer.

## Design

### README

- Rewrite **Current status** to include the analyst console, human handoff,
  employee conversations dashboard, measured login indicators, thinking state,
  and chat error notifications. State plainly that visual fidelity is partial
  and live-model reliability remains under #10.
- Remove the three false "not implemented/planned separately" statements about
  human support (current lines 8, 70, and 105) and replace the ticket-transfer
  paragraph with the implemented queue and ownership behavior.
- Add **Architecture** with the Next.js web, NestJS API, Mastra agent,
  Prisma/SQLite boundary, server-owned identity, and typed contracts. Link
  `docs/architecture.md` for detail.
- Add **Trade-offs and limits**: demo authentication, SQLite persistence, no
  paid fallback, deterministic fixture engine separate from live evidence,
  partial prototype fidelity, and the absent private reference bundle in this
  checkout.
- Add a short **Requirements checklist** section linking
  `docs/submission-checklist.md`.
- Refresh the documentation list so the newer verification records are
  discoverable.

### `docs/submission-checklist.md`

Three compact tables:

1. **Behavioral acceptance (B01–B18)** — status and evidence link for each row.
2. **Visual acceptance (V01–V06)** — status and evidence link for each row.
3. **Submission gates** — clean setup, deterministic checks without a model key,
   live evaluation record, README accuracy, demo script, and interview
   walkthrough.

Status vocabulary:

- **Demonstrated** — executed deterministic or browser evidence exists.
- **Partial** — some acceptance criteria or fidelity remain open.
- **Pending** — no executed evidence yet.
- **Not claimed** — outside the current delivery and explicitly disclosed.

The checklist derives expected results from the acceptance matrix and
verification documents, not from current application output. It distinguishes
deterministic evidence from live-provider evidence and does not mark skipped
visual checks as passing.

### Stale statement corrections

- `docs/challenge-context.md`: replace the #68 "remains on branch" sentence with
  the merged PR #67 record and note that #65 and #68 are closed.
- `docs/chat-error-notifications-verification.md`: replace the branch-mismatch
  limit with the merge record; keep the substantive limits.
- `docs/roadmap.md`: record the #65/#68 delivery and merge under the #9/#10
  tracking text.
- `docs/architecture.md`: change "in-progress foundation" to the delivered
  foundation only if the surrounding description is otherwise current.

### Documentation links

The README list will include the acceptance matrix, architecture, roadmap, and
the verification documents for identity/history, tickets, consultation, drafts,
autonomous resolution, handoff, human support, session limit, login viewport,
service metrics, employee visuals, thinking indicator, and chat errors.

## Constraints

- Engineering documents in English; user-facing copy in Brazilian Portuguese.
- Evidence links stay relative and inside the repository.
- The private reference bundle remains unavailable here; visual rows stay
  partial and the limitation is disclosed.
- Documentation-only delivery; no application test run is required. Validate
  links, claim accuracy against existing evidence, and `git diff --check`.

## Left to the builder

- Exact wording, table ordering, and link labels.
- Whether the architecture summary needs one short diagram or only prose.
- Any additional stale phrase found during the accuracy pass, limited to claims
  contradicted by merged work.
