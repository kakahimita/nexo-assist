# Human handoff verification

Scope: issue #8, employee-side handoff core. This increment persists an employee
request or an authorized automatic trigger as a durable conversation state. It
does not implement the analyst queue, claiming, analyst replies, return to agent
or close controls required by B11.

## Deterministic evidence

Using the fixture engine, controllable test engines, fictional accounts and
isolated temporary SQLite databases, the final local verification passed:
typecheck, lint, formatting, 127 unit tests (22 files), the full integration
suite, production build and 29 Chromium browser tests. No model key was used;
`npm run smoke:model` was not run.

- B09 / PRD pp. 2, 4: an employee request, critical draft classification,
  overdue owned ticket and an engine uncertainty event each persist the reason,
  deterministic server-derived summary and request time. The request body accepts
  only the reason; a forged summary is rejected.
- B10 / PRD pp. 1-2: a waiting conversation still stores employee messages but
  does not invoke the engine. A handoff during a streamed turn invalidates the
  state-version guard, discarding the late generated answer rather than storing
  or showing it.
- B13 / PRD p. 2: the waiting state and its handoff metadata survive API restart
  and are not reset when the employee creates another conversation.
- B14 / PRD p. 2: waiting messages continue through the same server-enforced
  employee-message limit; the existing cap behavior remains covered separately
  by issue #23.
- Browser coverage verifies the employee can request human support, sees the
  waiting status, and can send a subsequent message without an agent response.

## Boundaries

The live Mastra prompt may request the structured `handoff` decision when facts
are sufficient but a safe answer is unavailable. The server, not model text,
persists the state transition. Live provider reliability for that decision was
not evaluated in this increment. Assignment and analyst ownership states remain
future issue #8 work; therefore B11 and the full analyst portions of B10/B13 are
not claimed here. Full visual fidelity remains issue #9.
