# Persistent Conversation Flow Design

## Intent

Keep an employee's support case coherent across short replies, reloads, and
server restarts. Ticket consultation is an explicit interruption that shows the
employee's ticket picker and then returns to the prior support case.

## Goals

- Persist the current support flow, stage, collected facts, and optional ticket
  selection for each conversation.
- Treat concise replies as facts for the active case, not new unrelated intents.
- Show the existing ticket-selection UI only for an explicit ticket consultation.
- Validate the selected ticket server-side against the authenticated employee.
- Resume the support case after a ticket consultation.

## Non-goals

- Replacing persisted message history, draft versions, or human-handoff state.
- Letting a model select a ticket or mutate the persisted flow without server
  validation.

## Approach

Store a versioned, validated flow snapshot on `Conversation`. The backend
loads it before running consultation, derives the next transition from the
employee message, and persists the updated snapshot atomically with the agent
turn. The frontend sends a typed ticket-selection message rather than a ticket
title, so a title collision cannot select the wrong ticket.

The flow supports `support` and `ticket_consultation` modes. Ticket consultation
stores the suspended support snapshot; once the selected ticket is answered,
the backend restores it. Conversation ownership and handoff state remain the
source of truth for whether the agent may respond.

## Alternatives considered

- Reconstructing state from all messages avoids a migration but repeats the
  current ambiguity and cannot reliably resume a partially completed flow.
- Persisting the state on `Conversation` is the selected approach because it
  is restart-safe and works for every support category.
