# Conversational ticket drafts verification

Scope: issue [#24](https://github.com/kakahimita/nexo-assist/issues/24), part of
[#7](https://github.com/kakahimita/nexo-assist/issues/7). This delivery lets an
employee propose, review, edit, cancel and explicitly confirm a ticket creation,
supplement or reopening from the conversation. The backend stays authoritative
for ownership, classification, duplicate and reopening rules, version checks and
writes; the collector derives a draft reference only from a validated successful
tool result. This record is not evidence that every issue criterion is complete.

## Deterministic evidence

Using the fixture engine, isolated temporary SQLite databases and fictional
accounts, `npm run check` passed at the delivery revision: typecheck, lint, 125
unit tests (22 files), 41 integration tests (17 files), build, and 28 browser
tests.

- B04 / PRD pp. 4–5: incomplete opening requests ask for impact, work state,
  urgency and affected scope before proposing; a complete request produces a
  draft card with confirm/edit/cancel; editing invalidates a stale confirmation;
  cancelling does not write a ticket; a confirmed draft creates exactly one
  ticket. Exercised by browser tests and the draft integration suite.
- B05 / PRD p. 4: exact normalized-title and deterministic possible candidates
  are returned for explicit employee selection; confirmation re-runs the matching
  transactionally and always blocks exact matches. Retried and double
  confirmation commit once (operation IDs and version checks).
- B06 / PRD p. 4: reopening stays within seven elapsed calendar days inclusive;
  state changes between proposal and confirmation are rechecked at confirmation.
  Supplements of resolved tickets and unknown/foreign identifiers are refused
  without data leakage.
- B07 / PRD p. 4: impact and urgency determine priority; missing or contradictory
  facts cause clarification instead of an inferred classification.
- B12 / PRD p. 2: the proposal action and its evidence derive only from the
  validated `propose-ticket-draft` tool result; a failed tool never renders a
  success action or a draft card.
- B13 / PRD p. 2: a proposed draft reference is bound atomically to its owner,
  conversation and run; an owner-authorized reload recovers the pending draft
  after an interrupted run, and another employee cannot read it.
- B14 / PRD p. 2: confirm/edit/cancel controls do not consume the 30-message
  budget (exercised at the cap); the cap itself is delivered by #23.
- B16 / PRD pp. 2, 4: tool authorization is server-bound; forged identity or
  draft references and injected instructions in employee text are ignored or
  rejected in controlled tests.

## Live model gate

On 2026-11-03 (America/Sao_Paulo), `npm run smoke:consultation` was run with the
production Mastra adapter, the real tools and an isolated temporary database. The
provider key was read from the main checkout environment without being copied
into the worktree. The six pre-existing consultation scenarios passed.

The four draft scenarios were less reliable. With prompt `consultation-v4` and the
free-tier `gemini-3.5-flash-lite`, three of four failed: complete draft creation
(the `propose-ticket-draft` call failed validation, so no pending draft persisted),
incomplete draft request (the decision returned `answer` instead of `clarify`),
and duplicate draft request (the open `Notebook lento` ticket was not surfaced).
Only draft prompt injection passed.

The prompt was tightened to `consultation-v5`, spelling out the exact tool enums,
requiring verbatim title and description, using `clarify` whenever facts are
missing, and always calling `propose-ticket-draft` so the tool reports duplicates.
This fixed the incomplete-draft scenario on the free-tier model, but complete
creation and duplicate detection still fail there. Running the same prompt on
`gemini-3.5-flash` (the non-lite sibling, which is a paid tier) passed all three
remaining draft scenarios in one clean run; the run was noisy and the free key is
rate-limited, so this is one observation, not a reliability guarantee.

| Model / prompt | create-draft | draft-incomplete | draft-duplicate | draft-injection |
| --- | --- | --- | --- | --- |
| `gemini-3.5-flash-lite` / v4 | Fail | Fail | Fail | Pass |
| `gemini-3.5-flash-lite` / v5 | Fail | Pass | Fail | Pass |
| `gemini-3.5-flash` / v5 (paid) | Pass | Pass | Pass | Pass* |

\* one observation on a rate-limited free key.

The deterministic draft flow is complete, but the free-tier live model does not
yet reliably drive `propose-ticket-draft` for complete creation or recognize an
open ticket as a duplicate. Broader live reliability and prompt-injection
resistance belong to #10, consistent with how #6 was closed. Switching the default
to a paid model was deliberately not done, to keep the no-paid-fallback principle.

## Boundaries and review

The deterministic candidate matcher (normalized title plus meaningful title and
description terms) cannot guarantee semantic recall of every paraphrase or
semantic duplicate; this limit is documented and representative paraphrases are
tested separately. Human handoff and analyst ownership remain #8; a critical
incident is identified without falsely claiming a transfer occurred, so B09 is
not complete. Full visual fidelity remains #9. No original challenge documents,
screenshots or database files are committed.
