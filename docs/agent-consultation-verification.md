# Agent consultation verification

Scope: issue [#6](https://github.com/kakahimita/nexo-assist/issues/6), continuation [#19](https://github.com/kakahimita/nexo-assist/issues/19). The knowledge foundation was merged in PR #18 and the streaming consultation increment in [PR #20](https://github.com/kakahimita/nexo-assist/pull/20) (merge commit `50350d5`), which closed #19. Issue #6 stays open for the criteria now owned by #7, #8, #9 and #10. This record is not evidence that every issue criterion is complete.

## Deterministic evidence

Using the fixture engine, isolated temporary SQLite databases, and fictional accounts:

- B02 / PRD pp. 1, 4: platform normalization, applicable Windows 10 and 11 knowledge, unknown-platform clarification and preservation of article edits are exercised. Incompatible or unknown-platform article instructions are withheld from the model projection.
- B03 / PRD pp. 1, 5: authorized ticket selection, title matching, unknown references and another employee's isolation are tested. Ticket selection uses the existing fictional identifiers, not production ticket numbers.
- B12 / PRD p. 2: tool-result-derived actions, article and ticket evidence, failure status, confidence estimates and readable detail are exercised with controlled results. Generated claims themselves are not independently proven accurate by the collector.
- B13 / PRD p. 2: agent messages and decisions are retrieved after API restart. B14 is partial: tests verify streaming before completion; the 30-message limit is not implemented here.
- B15 and B16 / PRD pp. 2, 4: controlled quota, provider 429, invalid output, interruption, failed tool, input validation, employee isolation and fixture-engine HR redirection are tested. Real model behavior under adversarial instructions remains unverified.
- UI checks cover keyboard quick replies and decision details, failed responses, reload, and narrow screens. The existing ticket workflow remains available. Human handoff and conversational ticket writes are not implemented in this increment.

The standard `npm run check` was run after the backend fixes: typecheck, lint, 112 unit tests, 29 integration tests and build passed at implementation revision `729522c`, but the browser stage could not start because port 3001 was already occupied by another Nexo Assist instance, which was preserved. An earlier standard run failed at the integration stage before the reproduced context bug was fixed. A separate Chromium run on ports 43100/43101 used an isolated database, one worker and copied tests with the diagnostic API URL adapted: 21 tests passed before the final backend fixes. The final combined local verification at implementation revision `d87bec9` passed typecheck, lint, 113 unit tests, 29 integration tests, an alternate-port build and 21 browser tests using the same isolated harness. Those local runs are not represented as a passing standard command.

The standard command passed afterwards in CI, on clean runners without the local port conflict: the full `npm run check`, including the browser stage, succeeded on Ubuntu and Windows for branch head `aba28bf` (run [41560732053](https://github.com/kakahimita/nexo-assist/actions/runs/41560732053), 116 unit, 29 integration and 21 browser tests) and for merge commit `50350d5` (run [41561321387](https://github.com/kakahimita/nexo-assist/actions/runs/41561321387)). The occupied-port block was a condition of one developer machine rather than a product limitation, so it is not an outstanding delivery limitation. Locally, ports 3000 and 3001 stay reserved for the running instance, where a repeat still needs the isolated harness or different ports.

The local application screenshots `outputs/consultation-desktop.png` (1440 × 900 viewport) and `outputs/consultation-mobile.png` (390 × 844 viewport) were inspected against the hash-verified original `.pen` frames `IcuoM` and `vbsNW` and the owner-supplied 3x secondary renderings. Chat bubbles, action evidence, options and details are present, but the current single-column layout, navigation and styling differ substantially from the prototype. Full visual completion remains #9; the secondary renders are not native Pencil exports.

## Live model gate

On 2026-11-02 (America/Sao_Paulo), `npm run smoke:consultation` was run with the production Mastra adapter, Google `gemini-3.5-flash-lite`, prompt `consultation-v1`, real read-only tools, and an isolated temporary database. The provider key was read from the main checkout environment for this process without being copied into the worktree. The command exited 1: **four of six scenarios passed**; both ticket-selection scenarios failed. These are results from one live run, not a general accuracy measurement.

| Scenario | Result | Duration | Reported total tokens | Observation |
| --- | --- | ---: | ---: | --- |
| VPN, Windows 10 | Pass | 4,434 ms | 1,387 | Windows 10 article evidence. |
| VPN, Windows 11 | Pass | 2,003 ms | 1,356 | Windows 11 article evidence; no Windows 10 evidence. |
| VPN, version unknown | Pass | 2,080 ms | 1,259 | Clarification requested, no platform-specific evidence. |
| Ticket status without number | Fail | 1,881 ms | 1,104 | The decision requested a number; expected the two owned ticket candidates. |
| Unknown reference | Fail | 2,071 ms | 1,108 | The decision answered that the reference was not found; expected selection or clarification with owned candidates. |
| Out-of-scope HR request | Pass | 1,171 ms | 566 | Redirect decision and no ticket action. |

The first Windows 11 decision also included an `Abrir chamado` quick reply, and the unknown-reference decision included `Criar novo chamado`. Instrumented calls with fictional data showed that the model sent `status` as a generic query and omitted the reference kind for `INC-99999`; both were previously treated as unmatched topics. The server now recognizes generic status questions and ticket references while keeping the owner filter, and removes quick replies offering unsupported ticket or device operations and human handoff. This quick-reply filter is heuristic and does not prove that every possible unsupported phrase will be caught.

After the correction, a second live `npm run smoke:consultation` run using Google `gemini-3.5-flash-lite` and prompt `consultation-v2` exited 0: **six of six scenarios passed**. Results below describe one run and are not a general accuracy guarantee.

| Scenario | Result | Duration | Reported total tokens |
| --- | --- | ---: | ---: |
| VPN, Windows 10 | Pass | 2,756 ms | 1,471 |
| VPN, Windows 11 | Pass | 1,817 ms | 1,453 |
| VPN, version unknown | Pass | 1,880 ms | 1,401 |
| Ticket status without number | Pass | 1,887 ms | 1,343 |
| Unknown reference | Pass | 1,800 ms | 1,417 |
| Out-of-scope HR request | Pass | 1,035 ms | 621 |

The corrected implementation passed `npm run check`: 116 unit, 29 integration and 21 browser tests, in addition to typecheck, lint and build. The full check ran before the metadata-only prompt-version bump from v1 to v2. Keep #6 open until its remaining criteria and the owner's review are complete.

## Boundaries and review

The collector builds evidence only from validated successful tool results; the model cannot supply an employee identity in a tool input. A failed turn is stored without fabricated evidence. Tool results and user content are untrusted, but model compliance with scope and prompt-injection instructions still requires live evaluation. The app does not yet persist human ownership or pause for an analyst; #8 owns that work. Session limits and confirmed conversational changes remain #7. No original challenge documents, screenshots or database files are committed.
