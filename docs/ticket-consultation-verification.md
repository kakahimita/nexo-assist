# Ticket consultation and overdue transfer verification

Issue: [#36](https://github.com/kakahimita/nexo-assist/issues/36), part of [#9](https://github.com/kakahimita/nexo-assist/issues/9). Design: [`2026-11-04-ticket-consultation-design.md`](superpowers/specs/2026-11-04-ticket-consultation-design.md). Plan: [`2026-11-04-ticket-consultation.md`](superpowers/plans/2026-11-04-ticket-consultation.md).

## What changed

- Consulted tickets carry `lastUpdate`, the start of the current clock (`slaStartedAt`). Employee supplements do not reset it.
- `ConsultationService` checks each `consult-tickets` result in backend code. One overdue owned ticket saves a deterministic agent message with the ticket card and requests a handoff with reason `overdue_ticket`. This runs for the deterministic and the live engines, so the model's text is not saved for that turn.
- The chat shows a detail card for one consulted ticket (status, priority, deadline, last update, and a text marker "Prazo vencido"). Several matches keep the selection buttons.
- On a handoff message, ticket buttons and quick replies are hidden.

## Executed checks

Run on branch `feature/LAB-0036` after the last code change.

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | passed |
| Lint | `npm run lint` | passed |
| Format | `npm run format:check` | passed |
| Unit | `npm test` | 26 files, 142 tests passed |
| Integration | `npm run test:integration` | 20 files, 52 tests passed |
| Build | `npm run build` | passed |
| Browser | `npm run test:e2e` | 36 tests passed |

Earlier in the same branch, one run of `npm run test:e2e` marked `consultation.spec.ts` (B02/B12) as flaky: the "Detalhes da decisão" assertion timed out once and passed on retry. That test does not use the new card or the transfer. Earlier commits in the history already fixed this toggle. It did not recur in the final run; treat it as a known risk.

## Acceptance mapping

| ID | Evidence |
| --- | --- |
| B03 | `consultation-tools.test.ts` (clock start per owned ticket); `consultation.service.integration.test.ts` (another employee's overdue ticket is never consulted or transferred); `consultation-drafts.integration.test.ts` (duplicate and supplement cases still use an in-deadline ticket) |
| B09 | `consultation.service.test.ts` (overdue transfer, model text ignored, multiple matches do not transfer); `consultation.service.integration.test.ts` (persisted handoff reason and state); `ticket-overdue-transfer.spec.ts` (real browser flow) |
| B10 | `captureAgentRun` returns `null` once the conversation is not `agent`, so the agent stays silent; `consultation.service.test.ts` covers a stale save with no second handoff |
| B12 | Handoff message decision shows the `handoff` action and the consulted ticket |
| B13 | `ticket-overdue-transfer.spec.ts` reloads the page and restores the waiting state and card; the integration test reloads messages from the database |

## Limits and open points

- **Live model not run.** No provider key was used, so the live engine path is covered only by its code path and by the deterministic tests. If the model never calls `consult-tickets`, the backend cannot see the ticket and does not transfer. Live reliability belongs to [#10](https://github.com/kakahimita/nexo-assist/issues/10).
- **Confidence shows 100%.** The transfer is a rule, not a model estimate. The details panel shows `Confiança estimada 100%`. This should be reviewed with the owner before submission.
- **Overdue tickets cannot be supplemented through chat.** Consulting one transfers the conversation. The supplement flow for in-deadline tickets is unchanged.
- **Two integration cases were adjusted.** `consultation-drafts.integration.test.ts` used the overdue fixture ticket for supplement and duplicate scenarios. Those cases now restart that ticket's clock inside the test, so they keep their original purpose.

## Visual comparison with Screen 3

Compared against `references/challenge/screens/03-ticket-consultation.png` (owner-supplied 3x guide, not a native Pencil export). Screenshot: `outputs/ticket-overdue-transfer-desktop.png` at 1440×900, not versioned.

Matches: the consultation happens inside the chat, the card has title, status, priority, deadline, overdue marker, and last update, and the transfer message follows the Screen 3 structure.

Differences that remain:
- The selection is a list of buttons, not a radio group with ticket numbers (`INC-…`). The data model has no public ticket number yet.
- The card has no category, no creation date, no status pill, and no amber highlight on the last update.
- The overdue offer buttons ("Falar com um analista", "Adicionar informação", "Não, obrigado") are intentionally absent: the transfer is automatic.
- The action chips read "Consulta de chamados", not the prototype's per-action labels.
