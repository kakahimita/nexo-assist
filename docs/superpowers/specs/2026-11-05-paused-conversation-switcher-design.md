# Paused conversation switcher design

**Issue:** to be created (follow-up of #49) on `feature/LAB-0046`. **Refs:** #9, #48.

## Intent

An employee whose conversation is waiting for, or assigned to, an analyst cannot start
another conversation today: the new-conversation action only appears after closure or at the
30-message cap. The automatic overdue handoff can therefore trap the employee with no way to
ask anything else. This change lets the employee open a new conversation while keeping the
paused one reachable.

## Behavior

- When the selected conversation is `waiting_for_analyst` or `with_analyst`, the chat shows a
  status bar with the state and an action **Iniciar nova conversa**.
- Starting a new conversation creates a normal agent conversation and selects it. The paused
  conversation is not resumed, closed, or modified; it stays in the analyst queue with its
  tickets and history.
- When the selected conversation is not paused but another conversation of the employee is
  waiting or with an analyst, the chat shows a bar with **Voltar ao atendimento**, which
  selects the most recent paused conversation and loads its messages.
- If several paused conversations exist, the bar points to the most recent; the others remain
  reachable only through the same rule after the shown one changes state. This is a disclosed
  simplification.
- The bar is contextual only: no permanent header action, preserving V02/V03 when the agent is
  active. It is keyboard reachable, announced as status, and stacks at 375 px.
- The existing **Nova conversa** action at the message cap or after closure stays unchanged.

## Non-goals

- A visible conversation-history list.
- Letting the agent answer inside a paused conversation.
- Closing or returning the paused conversation from the employee side.
- Backend changes; `POST /api/conversations` and `GET /api/conversations` already support the
  behavior.

## Verification

- Browser: overdue handoff → **Iniciar nova conversa** appears; clicking creates an empty
  conversation; **Voltar ao atendimento** returns to the paused conversation with its message
  and status; the analyst queue still contains exactly one waiting conversation; keyboard and
  375 px checks.
- No new-conversation bar in a normal agent conversation.
- Existing suites stay green; `npm run check` is the gate.

## Disclosures

- Starting a new conversation does not notify the analyst; the paused conversation remains in
  the queue.
- Reload resumes the newest conversation (existing rule); the paused conversation is reachable
  through **Voltar ao atendimento**.
