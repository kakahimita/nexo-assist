# Human support verification

Scope: issue #30, the analyst console. This increment adds the analyst queue,
atomic claim, reply, return-to-agent, and close operations on top of the durable
handoff lifecycle from #29, and shows analyst replies to the employee as ordinary
thread messages.

## Deterministic evidence

Using the fixture engine, fictional accounts and isolated temporary SQLite
databases, the final local verification passed: typecheck, lint, formatting,
unit tests, the full integration suite, production build, and 30 Chromium
browser tests. No model key was used; `npm run smoke:model` was not run.

- B11 / PRD pp. 1-2, 4: an analyst lists and filters waiting conversations
  (`Para você`, `Minhas`, `Todas`), reads the thread plus the employee's ticket
  panel, atomically claims (a second claim is `409`), replies (persisted as an
  `analyst` message with the author name), returns to the agent, and closes.
  Only the assigned analyst may reply, return, or close; a second analyst and an
  employee get `403`/`404`.
- B10 / PRD p. 2: the agent stays silent while `waiting_for_analyst` and
  `with_analyst`; a handoff during a streamed turn and a claim/return both
  advance the state/version guard, so a late agent answer is discarded rather
  than stored or shown.
- B13 / PRD p. 2: the `with_analyst` state, `assignedAnalystId`, and `closedAt`
  survive an API restart, verified by a restart integration test.
- B15 / PRD p. 2: analyst replies are plain persisted messages (no model call),
  so human support keeps working when the model quota is exhausted.
- Browser coverage verifies the full loop: an employee hands off, an analyst
  claims and replies, the employee sees the reply, and the analyst closes.

## Boundaries

The console is functional, not pixel-faithful to frames V04/V05; visual fidelity
remains issue #9. Live-model reliability for the agent's handoff decision remains
issue #10. Ticket state is read-only context in this increment (the console does
not modify ticket status). `npm run smoke:model` was not run (no local provider
key).
