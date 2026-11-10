# Chat error notifications design

**Issue:** #68 (follow-up to #65, kept on branch `feature/LAB-0065` by owner request)

**Status:** Approved and executed at revision `2ba547e`; evidence in
`docs/chat-error-notifications-verification.md`.

## Intent

When the employee chat fails, the current UI shows the same plain inline
`role="alert"` paragraph regardless of cause. The copy is vague, especially for
exhausted Gemini tokens and provider outages. The owner wants a clearer,
better-designed notification that appears as a five-second toast, without
adding recovery actions.

## Goals

- Show a non-blocking toast with an icon, a cause-specific title and body, a
  close action, and an approximately five-second lifetime.
- Pause the timer while the toast is hovered or contains focus; a new error
  replaces the toast and restarts the timer.
- Respect `prefers-reduced-motion` and never cover the composer or block the
  conversation.
- Keep a redesigned inline error as the persistent record after the toast
  disappears.
- Cover appearance, auto-dismiss, manual close, and inline persistence in
  Chromium.

## Non-goals

- No retry button, key-change flow, analyst shortcut, or automatic fallback.
- No new backend error codes or provider classification; `quota`,
  `model_unavailable`, `invalid_output`, `interrupted`, and the generic
  transport failure remain the inputs.
- No change to streaming, orchestration, handoff, drafts, session limits, or
  resolution.
- No comparison with the original Pencil/PDF assets; the private bundle is
  unavailable.

## Approach chosen

Front-end only: one copy module, one toast component, and a redesigned inline
error. A blocking modal was rejected because a five-second focus trap interrupts
typing and disappears before reading. Adding recovery actions was rejected
because the owner scoped this to notification only. A new `auth` error code was
rejected to keep API behavior and contracts unchanged.

## Copy

| Code | Title | Body |
| --- | --- | --- |
| `quota` | Limite de uso atingido | Os tokens gratuitos do Gemini para esta chave acabaram. Tente novamente mais tarde. |
| `model_unavailable` | Assistente indisponível | Não consegui falar com o provedor do modelo agora. Pode ser uma instabilidade temporária; tente novamente em instantes. |
| `invalid_output` | Resposta não validada | O assistente respondeu em um formato que não pude validar. Tente novamente. |
| `interrupted` | Resposta interrompida | A conexão terminou antes de a resposta chegar completa. Tente novamente. |
| generic transport failure | Não foi possível concluir | Recarregue a conversa para verificar o histórico antes de tentar novamente. |

A failed persisted message uses the same title and body for its error code.

## Interface behavior

- The toast is fixed at the top-right on desktop and spans the safe width on
  narrow screens, above the message area without covering the composer.
- It contains an icon, the title, the body, a `×` close button, and a subtle
  five-second progress line. No focus is moved automatically.
- While the toast is visible, the transient inline error is hidden so the same
  failure is not shown twice. When the toast auto-dismisses or is closed, the
  inline error appears and remains until the next send or reload.
- A new error replaces the current toast and resets the countdown.
- Human handoff and failed-message records keep their existing visibility.

## Accessibility

- The toast uses `role="alert"` and is announced once; the inline record has no
  live role while the toast is active, avoiding duplicate announcements.
- The close button is a native button with an accessible label.
- Hovering or focusing inside the toast pauses the countdown; leaving resumes a
  full five seconds. The persisted inline error means the five-second limit
  never destroys information.
- Motion is limited to a small entrance transition; reduced-motion removes it.

## Testing

- Gated quota stream: toast appears with the quota title and body, spinner is
  gone, inline is hidden; after auto-dismiss the inline quota error is visible.
- Gated unavailable stream: manual close hides the toast immediately and shows
  the inline unavailable error.
- Existing failed-turn, handoff, and thinking-indicator tests keep passing.
- Full `npm run check` plus the isolated targeted Chromium run.

## Constraints

- Issue #68 branch stays `feature/LAB-0065` by owner request; the mismatch is
  disclosed in the PR.
- Brazilian Portuguese user-facing copy; English engineering artifacts.
- Use the existing consultation feature, CSS conventions, and Playwright
  patterns.
