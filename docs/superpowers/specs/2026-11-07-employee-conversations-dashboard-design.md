# Employee conversations dashboard design

**Issue:** #64

## Intent

Employees need permanent, visible access to their persisted conversation history
and a clear way to start another chat. The owner supplied the target composition:
ticket cards followed by a conversation list in a dedicated employee view.

## Goals

- Show `Minhas conversas` and `Nova conversa` in the employee chat top bar,
  before the API-readiness indicator.
- Open a dedicated `Minhas conversas` view from the first action.
- Render only the signed-in employee's ticket cards and conversation summaries.
- Selecting a conversation returns to `Atendimento` and restores that chat.
- Create and select a new conversation from the second action, unless any
  conversation is paused for human support.
- Keep the existing sidebar `Atendimento` as the way back to the chat. Do not
  render a `Falar com o Nexo Assist` button.

## Non-goals

- Do not restore the retired standalone ticket editor or create ticket actions
  outside the conversational flow.
- Do not expose analyst-owned or another employee's tickets/conversations.
- Do not change agent, draft, SLA, or human-support behavior.

## Architecture

The existing authenticated `GET /api/tickets` remains the ticket source. Extend
the existing employee-owned conversation list contract with a server-computed
summary: its latest message, its timestamp, and the public number of an
associated context ticket when one exists. This avoids client-side fan-out to
each conversation message endpoint and preserves server-side authorization.

`History` remains the employee shell owner. It adds a `conversations` page
state, renders a focused dashboard component, and changes the selected
conversation before returning to `support`. The dashboard is read-only;
interactions are selection and navigation only.

## Interface behavior

- The chat header action `Minhas conversas` switches to the dashboard.
- `Nova conversa` invokes the existing creation flow. It is disabled when the
  shell is busy, creating, or any known conversation is
  `waiting_for_analyst`/`with_analyst`.
- The dashboard lists tickets in their server-provided order and summarizes
  open versus terminal counts from ticket status.
- Each conversation row exposes its latest available message, date/time,
  state label, and context-ticket number when available. Selecting it loads
  its messages and returns to `Atendimento`.
- The sidebar `Atendimento` selects the support page without creating a new
  conversation. There is no header return button on the dashboard.

## Accessibility and responsive behavior

All actions are native buttons. The dashboard uses labelled regions, preserves
keyboard operation, reports loading/error states, and must not introduce
horizontal overflow at 375 px wide.

## Source and constraints

The owner-provided screenshots in this conversation define this delivery's
layout direction. The private challenge reference bundle is unavailable in the
current checkout, so this increment cannot claim comparison against the
original Pencil/PDF assets. Existing API readiness remains distinct from model
provider availability.
