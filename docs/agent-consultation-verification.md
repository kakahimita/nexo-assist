# Agent consultation verification

Scope: issue [#6](https://github.com/kakahimita/nexo-assist/issues/6), continuation [#19](https://github.com/kakahimita/nexo-assist/issues/19). The knowledge foundation was merged in PR #18. This continuation is not evidence that every issue criterion is complete.

## Deterministic evidence

Using the fixture engine, isolated temporary SQLite databases, and fictional accounts:

- B02 / PRD pp. 1, 4: platform normalization, applicable Windows 10 and 11 knowledge, unknown-platform clarification and preservation of article edits are exercised. Incompatible or unknown-platform article instructions are withheld from the model projection.
- B03 / PRD pp. 1, 5: authorized ticket selection, title matching, unknown references and another employee's isolation are tested. Ticket selection uses the existing fictional identifiers, not production ticket numbers.
- B12 / PRD p. 2: tool-result-derived actions, article and ticket evidence, failure status, confidence estimates and readable detail are exercised with controlled results. Generated claims themselves are not independently proven accurate by the collector.
- B13 / PRD p. 2: agent messages and decisions are retrieved after API restart. B14 is partial: tests verify streaming before completion; the 30-message limit is not implemented here.
- B15 and B16 / PRD pp. 2, 4: controlled quota, provider 429, invalid output, interruption, failed tool, input validation, employee isolation and fixture-engine HR redirection are tested. Real model behavior under adversarial instructions remains unverified.
- UI checks cover keyboard quick replies and decision details, failed responses, reload, and narrow screens. The existing ticket workflow remains available. Human handoff and conversational ticket writes are not implemented in this increment.

The final standard `npm run check` was run after the backend fixes: typecheck, lint, 112 unit tests, 29 integration tests and build passed at implementation revision `729522c`. The browser stage failed to start because port 3001 was already occupied; the existing processes were preserved. An earlier standard run failed at the integration stage before the reproduced context bug was fixed. A separate Chromium run on ports 43100/43101 used an isolated database, one worker and copied tests with the diagnostic API URL adapted: 21 tests passed before the final backend fixes. The standard command is not represented as passing. The final combined verification at implementation revision `d87bec9` passed typecheck, lint, 113 unit tests, 29 integration tests, an alternate-port build and 21 browser tests using the same isolated harness. The standard browser command remains blocked by the occupied port.

The local application screenshots `outputs/consultation-desktop.png` (1440 × 900 viewport) and `outputs/consultation-mobile.png` (390 × 844 viewport) were inspected against the hash-verified original `.pen` frames `IcuoM` and `vbsNW` and the owner-supplied 3x secondary renderings. Chat bubbles, action evidence, options and details are present, but the current single-column layout, navigation and styling differ substantially from the prototype. Full visual completion remains #9; the secondary renders are not native Pencil exports.

## Live model gate

No local `GOOGLE_API_KEY` was present, so `npm run smoke:consultation` was **not run**. No provider/model latency, usage or live quality result is claimed. The command uses the production Mastra adapter and real read-only tools with a temporary database and checks Windows applicability, selection, privacy and scope. The default configured provider/model are Google and `gemini-3.5-flash-lite`; availability and quality have not been verified in this increment. Keep #6 open until the live evaluation and issue criteria are demonstrated.

## Boundaries and review

The collector builds evidence only from validated successful tool results; the model cannot supply an employee identity in a tool input. A failed turn is stored without fabricated evidence. Tool results and user content are untrusted, but model compliance with scope and prompt-injection instructions still requires live evaluation. The app does not yet persist human ownership or pause for an analyst; #8 owns that work. Session limits and confirmed conversational changes remain #7. No original challenge documents, screenshots or database files are committed.
