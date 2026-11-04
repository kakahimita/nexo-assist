# Ticket consultation in chat and automatic overdue transfer

Issue: [#36](https://github.com/kakahimita/nexo-assist/issues/36), part of [#9](https://github.com/kakahimita/nexo-assist/issues/9).

## Intent

The employee asks about a ticket in the chat. The agent shows the matching
tickets, lets the employee select one, and shows its status, priority, deadline,
and last update. If the ticket is overdue, the conversation is transferred to an
analyst automatically, with a summary and the reason. The prototype (Screen 3)
shows this flow; the PRD rules decide its behavior.

## Goals

- Ticket selection and the detail card appear inside the employee chat.
- The detail card shows status, priority, deadline, last update, and an overdue marker.
- An overdue consulted ticket creates a durable handoff. The backend enforces this
  check for both the deterministic engine and the live Mastra path.
- No model output can skip the overdue handoff.

## Non-goals

- Removing the existing "Chamados" tab. It stays as it is in this increment.
- Changing ticket creation, supplement, or reopen flows.
- Live model reliability (tracked by #10).

## Constraints

- Overdue is computed on the server with the existing rules
  (`apps/api/src/tickets/rules.ts`). The frontend does not compute it.
- The agent never chooses the authenticated identity or the ticket owner.
- Handoff rules follow Annex A and acceptance B09. The prototype's "offer" wording
  does not override them.

## Approaches

1. **Chat-embedded card, backend-enforced transfer (recommended).** The tool result
   carries `overdue`. The consultation service checks it after the ticket tool runs
   and requests the handoff before the agent can answer. Trade-off: the employee
   cannot decline the transfer, and the flow changes the agent's response.
2. **Chat-embedded card, prompt-only transfer.** Keep the model deciding the handoff.
   Rejected: the live path has no code check, so an overdue ticket could be answered
   without a transfer.
3. **Offer-first transfer.** Show the prototype's buttons and transfer only on click.
   Rejected by the owner after review: Annex A and B09 list overdue tickets as a
   transfer trigger.

Approach 1 was chosen by the owner on 2026-11-04.

## Design

- **Consultation:** the ticket list uses the `consult-tickets` tool result. When
  one ticket matches, the detail card renders inside the agent message. Several
  matches show a selection list in the same message.
- **Last update:** the ticket's `slaStartedAt`. Creation and reopening set it, and it
  is the start of the current clock. Employee supplements do not reset it, as
  the architecture's SLA rules require. No support-update write exists yet; the
  `support_updated` event kind is defined but unused, so when a support update path
  is added it must also move `slaStartedAt`.
- **Overdue transfer:** `consultation.service.ts` requests the handoff with reason
  `overdue_ticket` whenever a consulted ticket is overdue, regardless of the engine.
  The fixture engine already does this; the live path gains the same check.
- **Handoff message:** the employee sees the ticket card and a short explanation
  before the chat switches to "waiting for analyst".
- **Quick replies:** "Adicionar informação" and "Não, obrigado" are not offered for
  an overdue ticket, because the transfer is automatic.
- **Message counter:** keeps the current wording. The prototype's "nesta sessão"
  text is cosmetic and not part of this increment.

## Calls made without the owner

- The overdue message wording and the exact card layout follow the prototype's
  structure, not its sample copy.
- Last update uses `slaStartedAt`, not the event history, because the event history
  also records employee supplements, which the SLA rules do not count as updates.

## Left to the plan

- Test cases for deadline boundaries at business-hour edges (B08).
- The order of changes: contracts, backend check, UI card, browser test.
