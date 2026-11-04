# Ticket consultation and overdue transfer verification

Issue: [#36](https://github.com/kakahimita/nexo-assist/issues/36) and follow-up [#38](https://github.com/kakahimita/nexo-assist/issues/38), both part of [#9](https://github.com/kakahimita/nexo-assist/issues/9). Design: [`2026-11-04-ticket-consultation-design.md`](superpowers/specs/2026-11-04-ticket-consultation-design.md). Plan: [`2026-11-04-ticket-consultation.md`](superpowers/plans/2026-11-04-ticket-consultation.md); follow-up plan: [`2026-11-04-ticket-card-completion.md`](superpowers/plans/2026-11-04-ticket-card-completion.md).

## What changed

- Consulted tickets carry `lastUpdate`, the start of the current clock (`slaStartedAt`). Employee supplements do not reset it.
- The follow-up adds nullable `category` and `createdAt` to the shared consultation view, with `null` defaults. Both server projections select those fields explicitly; historical decisions without them still parse.
- `ConsultationService` checks each `consult-tickets` result in backend code. One overdue owned ticket saves a deterministic agent message with the ticket card and requests a handoff with reason `overdue_ticket`. This runs for the deterministic and the live engines, so the model's text is not saved for that turn.
- The chat shows a detail card for one consulted ticket with a status badge, category, priority, creation date in `America/Sao_Paulo`, deadline, amber last update, and the text marker "Prazo vencido". Missing metadata renders `—`. Several matches keep the selection buttons.
- On a handoff message, ticket buttons and quick replies are hidden.

## Executed checks

Run on branch `feature/LAB-0038` after the last code change.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | passed |
| Lint | `npm run lint` | passed |
| Format | `npm run format:check` | passed |
| Unit | `npm test` | 26 files, 144 tests passed |
| Integration | `npm run test:integration` | 20 files, 53 tests passed |
| Build | `npm run build` | passed |
| Browser | `npm run test:e2e` | 38 tests passed |
| Full gate | `npm run check` | passed |

Chromium was already installed from the preceding delivery. Integration and browser checks used their isolated temporary databases.

One intermediate browser run marked `restart.spec.ts` (B13) as flaky: it passed on retry. The final `npm run check` passed all 38 browser tests without a flake. Earlier in the predecessor branch, one run of `npm run test:e2e` marked `consultation.spec.ts` (B02/B12) as flaky; it did not recur here.

## Acceptance mapping

| ID | Evidence |
| --- | --- |
| B03 | `consultation-tools.test.ts` (clock start, category, and creation date per owned ticket); `consultation-tools.integration.test.ts` (authorized metadata returned, another employee's ticket and metadata absent); `ticket-card.spec.ts` (card fields, legacy `—` fallback, long-title layout); `consultation.service.integration.test.ts` (another employee's overdue ticket is never consulted or transferred); `consultation-drafts.integration.test.ts` (duplicate and supplement cases still use an in-deadline ticket) |
| B09 | `consultation.service.test.ts` (overdue transfer, model text ignored, multiple matches do not transfer); `consultation.service.integration.test.ts` (persisted handoff reason and state); `ticket-overdue-transfer.spec.ts` (real browser flow) |
| B10 | `captureAgentRun` returns `null` once the conversation is not `agent`, so the agent stays silent; `consultation.service.test.ts` covers a stale save with no second handoff |
| B12 | Handoff message decision shows the `handoff` action and the consulted ticket |
| B13 | `conversations.integration.test.ts` persists an agent decision whose `ticketsJson` predates the new fields, restarts the app, and reloads it as `null` metadata; `ticket-overdue-transfer.spec.ts` reloads the page, restores the waiting state and card, and confirms the restored handoff message still has no ticket choices or quick replies; `ticket-card.spec.ts` covers the streamed legacy payload |
| B16 | `consultation-tools.integration.test.ts` confirms only the authenticated employee's tickets and metadata are visible |
| V03 | `ticket-card.spec.ts` checks the card at 1440×900 and 375×812; visual comparison below remains partial |

## Limits and open points

- **Live model not run.** No provider key was used, so the live engine path is covered only by its code path and by the deterministic tests. If the model never calls `consult-tickets`, the backend cannot see the ticket and does not transfer. Live reliability belongs to [#10](https://github.com/kakahimita/nexo-assist/issues/10).
- **Confidence shows 100%.** The transfer is a rule, not a model estimate. The details panel shows `Confiança estimada 100%`. This should be reviewed with the owner before submission.
- **Overdue tickets cannot be supplemented through chat.** Consulting one transfers the conversation. The supplement flow for in-deadline tickets is unchanged.
- **Two integration cases were adjusted.** `consultation-drafts.integration.test.ts` used the overdue fixture ticket for supplement and duplicate scenarios. Those cases now restart that ticket's clock inside the test, so they keep their original purpose.

## Visual comparison with Screen 3

Compared against `references/challenge/screens/03-ticket-consultation.png` (owner-supplied 3x guide, not a native Pencil export) and PRD page 4. Application captures, not versioned: `outputs/ticket-card-1440x900.png` and `outputs/ticket-card-375x812.png` (full page), plus `outputs/ticket-card-1440x900-card.png` and `outputs/ticket-card-375x812-card.png` (card detail). The real backend transfer capture remains `outputs/ticket-overdue-transfer-desktop.png` at 1440×900.

Matches: the consultation happens inside the chat; the card has a status badge, category, priority, creation date, deadline, overdue text, and amber last update; the transfer message follows the Screen 3 structure. Long titles wrap at both widths and the card stays inside the viewport.

Differences that remain:
- The selection is a list of buttons, not a radio group with ticket numbers (`INC-…`). The data model has no public ticket number yet, and the card has no ticket reference line.
- The card has no description; the consultation wire view does not carry it.
- The status vocabulary is limited to "Aberto" and "Resolvido" by the data model, not the prototype's "Aguardando analista", "Em andamento", or "Aprovado".
- Creation date renders as `dd/mm/yyyy`, not the prototype's `16 out, 14:20`; the scope asked for a date.
- The overdue marker stays beside the deadline, where the existing text lived; the prototype places "prazo vencido" in the last-update line. The last update keeps its amber treatment.
- The overdue offer buttons ("Falar com um analista", "Adicionar informação", "Não, obrigado") are intentionally absent: the transfer is automatic.
- The action chips read "Consulta de chamados", not the prototype's per-action labels.
- Typography and spacing are approximate. Native Pencil exports are unavailable, so exact fidelity is not claimed.
