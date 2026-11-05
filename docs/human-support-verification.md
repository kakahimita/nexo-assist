# Human support verification

Scope: issue #30, the analyst console, with queue refinement in #40 and owned-conversation detail refinement in #42. This increment adds the analyst queue,
atomic claim, reply, return-to-agent, and close operations on top of the durable
handoff lifecycle from #29, and shows analyst replies to the employee as ordinary
thread messages.

## Deterministic evidence

Using the fixture engine, fictional accounts and isolated temporary SQLite
databases, the final local verification passed: typecheck, lint, formatting,
unit tests, the full integration suite, production build, and 46 Chromium
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

## Queue refinement evidence (#40)

On 2026-11-04, `npm run check` passed with isolated temporary databases.
The queue-specific browser coverage verifies the default `waiting` request,
the `all` and `owned` filters, loading, empty, failed-refresh/retry, stale
success and error rejection, preservation of selected detail/draft/action
error across retry, readable supported states and handoff reasons, timestamp
semantics, keyboard selection, and no horizontal overflow at 1440 x 900 and
375 x 812. The existing end-to-end analyst claim/reply/close workflow also
passed without replacing its backend interactions.

Local, uncommitted Chromium captures are in `outputs/`:

- `analyst-queue-loading-1440x900.png`
- `analyst-queue-empty-1440x900.png`
- `analyst-queue-error-1440x900.png`
- `analyst-queue-populated-1440x900.png`
- `analyst-queue-selected-1440x900.png`
- `analyst-queue-populated-375x812.png`

The populated desktop capture was compared with the original Pencil V04 frame
`x2HBOE` and the verified secondary guide `screens/04-analyst-queue.png`.
The implementation deliberately uses only the summary contract: employee,
last-message preview and timestamp, conversation state, and handoff reason.
The comparison found the compact queue hierarchy and responsive card legible;
it does not claim V04 or V05 pixel fidelity.

## Analyst detail evidence (#42)

On 2026-11-04, implementation revision `cf130ac` passed `npm run check` with
`E2E_WEB_PORT=3100 E2E_API_PORT=3101`: strict typecheck, lint, formatting,
unit tests, the full integration suite, production build, and 64 Chromium
tests. Integration and browser checks used isolated temporary SQLite
databases; the owner instance on ports 3000/3001 was left untouched. No model
key was used and `npm run smoke:model` was not run. A post-review configuration
correction replaced the unused `NEXT_PUBLIC_API_BASE_URL` example with the
server-side `API_BASE_URL`; the full check was rerun green on that state.

- B11 / PRD pp. 1-2, 4: waiting, assigned-to-self, assigned-to-another, agent
  and closed states show honest labels. Only waiting offers claim; only the
  assigned analyst sees reply/return/close. Backend ownership remains
  authoritative.
- B11: delayed success and delayed error responses for an older selection do
  not replace a newer selection. Loading a different conversation hides the
  previous detail, and a failed load offers `Tentar novamente` for the
  selected ID. The guards were mutation-checked by removing the abort and
  version protection and observing both race tests fail.
- B11 / B15: failed claim (`409`), reply (`403`), return (`403`) and close
  (`409`) keep the detail open, show an action error, show no success notice,
  and preserve the exact unsent reply. A rapid double submit sends one
  request.
- B11 / B15: a successful reply followed by a failed refresh clears the draft
  only after the POST succeeds, shows
  `Resposta enviada. Não foi possível atualizar a conversa.`, and retries only
  the GET. Whitespace-only and over-4000-character replies are rejected
  before any request.
- B11 / B15: successful return and close show
  `Atendimento devolvido ao agente.` and `Atendimento encerrado.`
  respectively; a failed queue refresh leaves the committed outcome and its
  notice intact.
- B11 / V05: message roles are identified in text as the employee, `Nexo
  Assist`, the real analyst `authorName`, or the `Suporte` fallback. Each
  timestamp keeps its original `dateTime`; HTML-looking content renders as
  text. Empty lists show `Nenhuma mensagem.` and `Nenhum chamado.`. The
  ticket panel shows only authorized title, category, Portuguese priority and
  status, deadline, and overdue marker.
- B11 / V05: keyboard selection, composer focus, and Enter submission pass;
  long unbroken messages and long ticket titles do not overflow the document
  or panels at 1567x900, 1440x900, and 375x812. Stacking at 375x812 was
  inspected manually.

Local, uncommitted Chromium captures are in `outputs/`:

- `analyst-detail-waiting-1567x900.png`
- `analyst-detail-owned-1567x900.png`
- `analyst-detail-other-1567x900.png`
- `analyst-detail-closed-1567x900.png`
- `analyst-detail-loading-1567x900.png`
- `analyst-detail-error-1567x900.png`
- `analyst-detail-ticket-empty-1567x900.png`
- `analyst-detail-waiting-375x812.png`
- `analyst-detail-owned-375x812.png`

The desktop captures were compared with the original Pencil V05 frame
`CAqx8` and the verified secondary guide `screens/05-analyst-owned.png` at the
native 1567x900 viewport. The queue, flexible conversation, and 340 px ticket
panel hierarchy is present. Deliberate differences remain: the application
shell replaces the prototype rail; the header omits unsupported presence,
department, avatar, public ticket numbers, and a timestamped claim event; the
ticket panel is a plain authorized list rather than “this conversation” and
“other tickets” groups; the composer uses a labeled textarea and button rather
than the prototype's inline arrow; typography, spacing, and ticket card
styling are not pixel-faithful. Native Pencil exports are still unavailable,
so exact V05 fidelity is not claimed.

## Boundaries

The console is functional, not pixel-faithful to frames V04/V05; visual fidelity
remains issue #9. Search, filter counts, unread/presence indicators, prototype
availability, ticket references, and the wider ticket-panel composition remain
outside #40 and are only partially addressed by #42. Live-model reliability for
the agent's handoff decision remains issue #10. Ticket state is read-only context
in this increment (the console does not modify ticket status).
`npm run smoke:model` was not run (no local provider key).
