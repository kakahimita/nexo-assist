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
remains issue #9. Filter counts, unread/presence indicators, prototype
availability, ticket references, and the wider ticket-panel composition remain
outside #40 and are only partially addressed by #42. Live-model reliability for
the agent's handoff decision remains issue #10. Ticket state is read-only context
in this increment (the console does not modify ticket status).
`npm run smoke:model` was not run (no local provider key).

## Analyst layout follow-up (#46)

The analyst shell now uses a compact navigation rail. At desktop widths, the
queue, conversation, and authorized ticket context are separate full-height
regions, and the reply composer occupies the conversation footer. Below 1200 px,
the ticket context stacks before the composer; below 800 px, the queue also
stacks above the detail. The support actions and server-provided content are
unchanged.

The original V04/V05 Pencil frames and the hash-verified owner renderings were
used for comparison. A local application capture is at
`outputs/analyst-console-v05-1567x900.png`. The three-region composition is
closer to V05. Typography, card density, message styling, and absent prototype
data (presence, counts, public ticket numbers) remain different. The
owner PNGs are secondary HTML/CSS renderings, so this is not a native pixel
comparison.

Direct inspection of `originals/nexo.pen` confirms a 64 px rail, 380 px queue,
340 px ticket panel, 64 px conversation header, and `#EEF1F5` conversation
background in V04/V05. The shell CSS now uses those values. A 36 px search
field follows the Pencil queue header and filters only loaded authorized
conversation names and message previews; ticket-number search remains unavailable
because the queue contract has no public ticket number. A browser test proves
name/message filtering and the honest empty result.

The V04/V05 conversation header now groups a 40 px employee avatar, real
employee name, server-derived ownership state, and existing actions. The
state badge uses the Pencil warning/success palette. The targeted V05 browser
case passed against the running project instance, using mocked queue/detail
responses and no ticket writes.

The first browser run found the ticket context below the composer at 375x812;
the CSS grid order was corrected and the second run passed all 64 Chromium
tests. Typecheck, lint, and build passed. A later `npm run check` passed through
unit, integration, and build but stopped at e2e because the owner's project
instance occupied port 3001. The full `npm run check` rerun with isolated ports
3100/3101 passed: typecheck, lint, formatting, 144 unit tests, integration,
build, and 64 Chromium tests. The local model smoke gate was not run.

## Ticket status at close (#49)

The analyst close action now carries an optional `outcome`. When the conversation's linked ticket is an active request (`REQ`), the console offers **Aprovar solicitação** and **Concluir atendimento**; incidents close with **Encerrar atendimento** and no outcome. The server validates the pair, applies `approved` or `resolved` in the same transaction as the conversation close, and records a `status_changed` event. Claiming moves the linked ticket to `in_progress`; returning to the agent keeps it there. An already terminal or missing ticket never blocks or rolls back the support action.

Integration coverage: outcome required for requests and rejected for incidents; incident close resolves; terminal ticket close leaves status and events unchanged; claim/return sequence. Chromium covers the request close choice, the number in the ticket context, and the unchanged incident control. The full `npm run check` passed (156 unit, 61 integration, 65 Chromium; one consultation browser case was retried as flaky). The limitation remains that a denied request has no dedicated state.

The ticket context panel groups the conversation's linked ticket under **Desta conversa** and the rest under **Outros chamados**, so the analyst can see which request the approve/conclude action changes. Capture: `outputs/analyst-close-choice-1440x900.png`.

## Handoff summary expand and collapse (#54)

The V05 handoff card keeps a 200 px collapsed summary area. When the summary
overflows, a `Ver mais` button next to `Solicitada em` expands the card to the
full text (with a `min(60vh, 480px)` safety cap and its own scroll); `Ver menos`
restores the collapsed height. Summaries shorter than the cap keep their natural
height and show no control. The control is a real button with `aria-expanded`
and `aria-controls`, operable by keyboard, and the state resets when another
conversation is selected. No server contract, typography, color or spacing
changed.

Executed evidence on 2026-11-06 from `feature/LAB-0054`: the full
`npm run check` passed with isolated ports 3102/3103 — typecheck, lint,
formatting, 650 unit tests, 232 integration tests, production build, and 76
Chromium tests. The new browser case covers the collapsed height, the toggle
label and `aria-expanded`, keyboard activation, expansion without overlapping the
message area, and the return to the collapsed height; the existing V05 case
asserts that a short summary shows no control. Captures from the owner instance
on port 3100: `outputs/handoff-before.png`, `outputs/handoff-collapsed.png` and
`outputs/handoff-expanded.png` (before 478 px card; after 200 px collapsed and
380 px expanded for the same summary). No model key was used and
`npm run smoke:model` was not run.

A first `npm run check` attempt stopped in the unit phase: the nested worktrees
under `work/` run duplicate copies of the same database-heavy knowledge test and
timed out under parallel load. The same suite passed on rerun, and the full check
then passed end to end. Those worktrees are local and ignored; excluding
`work/**` from Vitest discovery is not part of this increment.

