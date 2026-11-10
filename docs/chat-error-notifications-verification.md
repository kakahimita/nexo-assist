# Chat error notifications verification

Scope: issue #68, a follow-up to #65 kept on branch `feature/LAB-0065` by owner
request. The employee chat now shows a cause-specific five-second toast and a
redesigned persistent inline error. This is notification-only work; it does not
add retry, key-change, or recovery actions and does not change backend
classification.

## Copy

| Code | Title | Body |
| --- | --- | --- |
| `quota` | Limite de uso atingido | Os tokens gratuitos do Gemini para esta chave acabaram. Tente novamente mais tarde. |
| `model_unavailable` | Assistente indisponível | Não consegui falar com o provedor do modelo agora. Pode ser uma instabilidade temporária; tente novamente em instantes. |
| `invalid_output` | Resposta não validada | O assistente respondeu em um formato que não pude validar. Tente novamente. |
| `interrupted` | Resposta interrompida | A conexão terminou antes de a resposta chegar completa. Tente novamente. |
| generic transport failure | Não foi possível concluir | Recarregue a conversa para verificar o histórico antes de tentar novamente. |

A failed persisted message uses the same title and body for its error code.

## Behavior

The copy lives in `apps/web/src/features/consultation/errors.ts`. The toast is
fixed at the top-right on desktop and spans the safe width at 375 px, with an
icon, title, body, close button, and a five-second progress line. Its timer
pauses while the toast is hovered or contains focus and resumes with a full five
seconds; a new error replaces the toast and restarts the timer. Auto-dismiss and
the `×` close both reveal the redesigned inline card. While the toast is visible,
the inline card and the failed-message card are hidden so the same failure is
not repeated; once the toast disappears, the persistent card appears and the
failed-turn record remains after reload.

The toast is the only live region: it uses `role="alert"` and `aria-atomic`. The
inline card has no live role, avoiding a second announcement. The close button
is native and labelled `Fechar notificação`. Motion is limited to a small
entrance and the progress line; `prefers-reduced-motion: reduce` removes both.

## Executed evidence

- Targeted run: `E2E_WEB_PORT=3100 E2E_API_PORT=3101 npm run test:e2e -- apps/web/e2e/consultation.spec.ts`
  passed 8 Chromium tests. The `#68` pause case spends 5.5 seconds hovered to
  prove the pause, then waits for auto-dismiss and verifies exactly one inline
  error; the second case closes the toast on a 375 px viewport, checks the
  bounding box and horizontal overflow, and verifies the inline record.
- The existing `B12 B15` reload case now checks the new quota copy in the toast
  and in the persisted failed-message card.
- `#65 B14` still passes its thinking-indicator lifecycle and reduced-motion
  assertion.
- Full gate at implementation revision `2ba547e`: `npm run check` passed
  typecheck, lint, format check, 184 unit tests (35 files), 67 integration tests
  (25 files), the production build, and 89 Chromium tests.

## Limits

- The API still collapses missing/invalid keys and most provider failures into
  `model_unavailable`; no `auth` code was added.
- The notification offers no recovery action, by owner scope.
- The private challenge reference bundle is unavailable, so no original Pencil
  or PDF visual comparison is claimed.
- The branch remains `feature/LAB-0065` while the delivery issue is #68; the PR
  must disclose that mismatch.
