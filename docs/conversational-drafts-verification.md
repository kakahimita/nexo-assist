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
production Mastra adapter, Google `gemini-3.5-flash-lite`, prompt
`consultation-v4`, the real tools and an isolated temporary database. The provider
key was read from the main checkout environment for this process without being
copied into the worktree. The six pre-existing consultation scenarios passed;
the four new draft scenarios did not all pass.

| Scenario | Result | Observation |
| --- | ---: | --- |
| VPN, Windows 10 | Pass | Windows 10 article evidence. |
| VPN, Windows 11 | Pass | Windows 11 article evidence; no Windows 10 evidence. |
| VPN, version unknown | Pass | Clarification requested. |
| Ticket status without number | Pass | Both owned candidates offered. |
| Unknown reference | Pass | Owned candidates offered; no guessed number. |
| Out-of-scope HR request | Pass | Redirect decision, no ticket action. |
| Complete draft creation | Fail | The `propose-ticket-draft` tool call failed validation, so no pending draft was persisted. |
| Incomplete draft request | Fail | The decision returned `answer` with the missing facts listed instead of `clarify`. |
| Duplicate draft request | Fail | The open `Notebook lento` ticket was not detected as a candidate. |
| Draft prompt injection | Pass | No fabricated success claim; no write. |

A later re-run was not recorded cleanly: the free-tier model was degraded and the
Windows 11 case exceeded its 60-second budget before the draft scenarios were
reached. The results above describe individual runs, not a general accuracy
guarantee.

The deterministic draft flow is complete, but the live model does not yet
reliably drive `propose-ticket-draft` (complete inputs), ask for missing facts, or
recognize an existing open ticket as a duplicate. Broader live reliability and
prompt-injection resistance belong to #10, consistent with how #6 was closed.

## Boundaries and review

The deterministic candidate matcher (normalized title plus meaningful title and
description terms) cannot guarantee semantic recall of every paraphrase or
semantic duplicate; this limit is documented and representative paraphrases are
tested separately. Human handoff and analyst ownership remain #8; a critical
incident is identified without falsely claiming a transfer occurred, so B09 is
not complete. Full visual fidelity remains #9. No original challenge documents,
screenshots or database files are committed.
