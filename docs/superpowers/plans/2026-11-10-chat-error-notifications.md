# Chat Error Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vague inline chat error with a cause-specific five-second toast and a redesigned persistent inline record, without adding recovery actions.

**Architecture:** A small copy module maps the existing stream error codes to title/body text. A toast component owns the five-second timer, hover/focus pause, close action, and reduced-motion styling. `Consultation` keeps the notification state and the persistent inline error, hiding the inline duplicate while the toast is visible.

**Tech Stack:** TypeScript, React/Next.js 16, CSS, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-chat-error-notifications-design.md`

## Global Constraints

- Issue #68 stays on branch `feature/LAB-0065` by owner request; disclose the mismatch in the PR.
- User-facing copy is Brazilian Portuguese; engineering artifacts are English.
- No backend, contract, or error-code changes.
- No retry, key-change, analyst-shortcut, or automatic-fallback actions.
- Keep streaming, handoff, failed-turn records, drafts, session limits, and resolution behavior unchanged.
- Chat toasts must not block the conversation or cover the composer.
- `apps/web/AGENTS.md` requires reading the relevant local Next.js guide before editing web code.

## Review Focus

- Hover or focus pauses the countdown, and leaving resumes a full five seconds; test A.
- Auto-dismiss and manual close each leave exactly one inline error; tests A and B.
- Screen readers receive one alert, not one per rendered error card; test A asserts a single `role="alert"`.
- At 375 px the toast stays inside the viewport and adds no horizontal overflow; test B.
- Reduced motion removes the entrance and progress animations; test A asserts computed `animation-name: none`.

---

### Task 1: Add error copy, toast, and inline redesign

**Files:**
- Create: `apps/web/src/features/consultation/errors.ts`
- Create: `apps/web/src/features/consultation/error-toast.tsx`
- Modify: `apps/web/src/features/consultation/consultation.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/e2e/consultation.spec.ts`

**Interfaces:**
- Produces `chatErrorCopy(code?: string | null): ChatErrorCopy` where `ChatErrorCopy = { title: string; body: string }`.
- Produces `ErrorToast({ title, body, onDismiss }: { title: string; body: string; onDismiss: () => void }): React.JSX.Element`.
- `Consultation` keeps `error: ChatErrorCopy | null` and `notification: { id: number; code: string | null } | null`.

- [ ] **Step 1: Read the local Next.js guides required by `apps/web/AGENTS.md`**

Read `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` and
`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`.

- [ ] **Step 2: Write the failing browser tests**

In `apps/web/e2e/consultation.spec.ts`, add a shared fixture helper above the
tests:

```ts
function failedStreamEvents(code: 'quota' | 'model_unavailable') {
  const timestamp = '2026-11-10T12:00:00.000Z';
  return [
    {
      type: 'user-message',
      message: {
        id: `user-${code}`,
        content: 'VPN',
        createdAt: timestamp,
        role: 'employee',
        status: 'completed',
        decision: null,
        authorName: null,
      },
    },
    { type: 'error', code },
    {
      type: 'done',
      message: {
        id: `agent-${code}`,
        content: 'Não foi possível concluir a resposta.',
        createdAt: timestamp,
        role: 'agent',
        status: 'failed',
        authorName: null,
        decision: {
          intent: 'Consulta indisponível',
          action: 'unavailable',
          appliedRule: 'Falha',
          confidence: 0,
          justification: 'Indisponível',
          missingFacts: [],
          quickReplies: [],
          actions: [],
          evidence: [],
          tickets: [],
          outcome: 'failed',
          errorCode: code,
          source: 'deterministic',
        },
      },
    },
  ];
}
```

Add the two tests:

```ts
test('#68 B15: pauses the error toast and keeps exactly one inline error', async ({ page }) => {
  await start(page);
  const chat = page.getByRole('region', { name: 'Conversa' });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/conversations/*/messages/stream', async (route) => {
    await gate;
    await route.fulfill({
      status: 201,
      contentType: 'text/event-stream',
      body: failedStreamEvents('quota')
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(''),
    });
  });
  await send(page, 'VPN');
  release();
  const toast = page.getByRole('alert');
  await expect(toast).toContainText('Limite de uso atingido');
  await expect(toast).toContainText('Os tokens gratuitos do Gemini');
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(chat.locator('.chat-error-inline')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(toast).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.chat-error-toast-progress')).toHaveCSS('animation-name', 'none');
  await toast.hover();
  await page.waitForTimeout(5500);
  await expect(toast).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('alert')).toHaveCount(0, { timeout: 7_000 });
  await expect(chat.locator('.chat-error-inline')).toHaveCount(1);
  await expect(chat.locator('.chat-error-inline')).toContainText('Limite de uso atingido');
});

test('#68 B15: closes the error toast manually on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await start(page);
  const chat = page.getByRole('region', { name: 'Conversa' });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/conversations/*/messages/stream', async (route) => {
    await gate;
    await route.fulfill({
      status: 201,
      contentType: 'text/event-stream',
      body: failedStreamEvents('model_unavailable')
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(''),
    });
  });
  await send(page, 'VPN');
  release();
  const toast = page.getByRole('alert');
  await expect(toast).toContainText('Assistente indisponível');
  const box = await toast.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Fechar notificação' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(chat.locator('.chat-error-inline')).toHaveCount(1);
  await expect(chat.locator('.chat-error-inline')).toContainText('Assistente indisponível');
});
```

Update the existing `B12 B15` test: after release, replace its alert text
assertion with `await expect(page.getByRole('alert')).toContainText('Limite de uso atingido');`
and after reload replace the alert assertion with
`await expect(page.getByText('Limite de uso atingido')).toBeVisible();`.

- [ ] **Step 3: Build and run the targeted tests to verify failure**

Run:

```bash
npm run build
E2E_WEB_PORT=3100 E2E_API_PORT=3101 npm run test:e2e -- apps/web/e2e/consultation.spec.ts --grep "#68"
```

Expected: FAIL because the toast, copy module, and inline classes do not exist.

- [ ] **Step 4: Create `errors.ts`**

Export `ChatErrorCopy` and `chatErrorCopy(code?: string | null): ChatErrorCopy`.
Use the exact copy from the spec table for `quota`, `model_unavailable`,
`invalid_output`, and `interrupted`, with the generic transport failure as the
fallback for `null`, `undefined`, or an unknown code.

- [ ] **Step 5: Create `error-toast.tsx`**

A client component that renders the toast with an inline warning SVG
(`aria-hidden`), a title `<p>`, a body `<p>`, a native close button labelled
`Fechar notificação`, and a decorative progress span. Track `hovered` and
`focused`; `paused` is their OR. A `useEffect` starts
`window.setTimeout(onDismiss, 5_000)` only while not paused and clears it on
cleanup. Keep `onDismiss` in a ref so parent re-renders do not restart the
timer. Increment a `run` counter when `paused` changes from true to false and
use it as the progress span `key`, so the bar restarts with the timer. The
container is `role="alert"`, `aria-atomic="true"`, with `onMouseEnter`,
`onMouseLeave`, `onFocus`, and `onBlur` (only clear focus when the new target
is outside the container). Add `data-paused={paused}`.

- [ ] **Step 6: Wire the state and rendering in `consultation.tsx`**

1. Replace the `errors` map with imports of `chatErrorCopy` and `ErrorToast`.
2. Change `error` to `ChatErrorCopy | null`. Convert every existing string
   `setError` call to an object with a short title and body; keep the messages
   honest. `setError('')` becomes `setError(null)`.
3. Add `notification` and a numeric `notificationId` ref. Add
   `notify(code: string | null)` that increments the ref and sets the
   notification.
4. On the stream `error` event, set the copy and notify with the code. In
   `send()`'s catch, set `chatErrorCopy(null)` and notify `null`.
5. Render `<ErrorToast key={notification.id} {...chatErrorCopy(notification.code)} onDismiss={() => setNotification(null)} />`
   at the top of the section when notification exists.
6. Render the persistent inline error when `error` exists, no notification is
   visible, and the last message is not a failed agent message. Use
   `<div className="chat-error-inline">` with the shared warning SVG, title, and
   body; do not give it a live role.
7. Replace the failed-message `<p role="alert">` with the same inline card using
   `chatErrorCopy(message.decision?.errorCode)` and no live role.
8. Keep the human-support button condition, the thinking indicator, and all
   existing quick-reply logic unchanged.

- [ ] **Step 7: Add the CSS**

In `apps/web/src/app/globals.css`, add a fixed toast at `top: 80px; right: 24px`,
`width: min(380px, calc(100vw - 32px))`, a warm error surface, a three-column
grid (icon, copy, close), and a soft shadow. At `max-width: 600px`, use
`top: 16px; left: 16px; right: 16px; width: auto`. Add an entrance animation and
a five-second progress animation (`transform: scaleX` from 1 to 0, origin left)
with `animation-play-state: paused` when `data-paused="true"`. Add
`.chat-error-inline` as a bordered, left-accented card with icon, title, and
body. Under `prefers-reduced-motion: reduce`, set `animation: none` for the
toast and progress bar.

- [ ] **Step 8: Build and run the targeted tests to verify success**

Run:

```bash
npm run build
E2E_WEB_PORT=3100 E2E_API_PORT=3101 npm run test:e2e -- apps/web/e2e/consultation.spec.ts
```

Expected: PASS, including the two new #68 tests and the updated B12 B15 case.

- [ ] **Step 9: Format, typecheck, and lint**

Run `npm run format`, `npm run typecheck`, and `npm run lint`.
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/features/consultation/errors.ts apps/web/src/features/consultation/error-toast.tsx apps/web/src/features/consultation/consultation.tsx apps/web/src/app/globals.css apps/web/e2e/consultation.spec.ts
git commit -m "feat: improve chat error notifications"
```

### Task 2: Run the full gate and record evidence

**Files:**
- Create: `docs/chat-error-notifications-verification.md`
- Modify: `docs/challenge-context.md`
- Modify: `docs/challenge-acceptance.md`
- Modify: `docs/superpowers/plans/2026-11-10-chat-error-notifications.md`
- Modify: `docs/superpowers/specs/2026-11-10-chat-error-notifications-design.md`

**Interfaces:**
- Consumes the committed implementation from Task 1 and its test output.

- [ ] **Step 1: Stop the development server and run the complete gate**

The browser gate needs ports 3000/3001 free. Stop the background `npm run dev`
process tree, then run `npm run check`. Expected: typecheck, lint, format,
unit tests, integration tests, build, and all Chromium tests pass. Restart the
development server after the gate so the owner can test in the browser.

- [ ] **Step 2: Write `docs/chat-error-notifications-verification.md`**

Record issue #68, the chosen approach, the exact copy, toast timing/pause/close
behavior, inline persistence, accessibility decisions, executed targeted and
full-gate results with counts, and the limits: no backend error classification,
no recovery actions, no original-reference visual comparison, and the branch
still belongs to LAB-0065.

- [ ] **Step 3: Update maintained context and acceptance**

Add one paragraph to `docs/challenge-context.md` linking the verification
document. Add one line to `docs/challenge-acceptance.md` stating that #68 covers
the B15 error-communication portion and does not change backend classification.
Update the plan and spec status lines to record the executed outcome.

- [ ] **Step 4: Format and verify documentation links**

Run `npm run format:check` and `git diff --check`.
Expected: PASS.

- [ ] **Step 5: Commit the evidence**

```bash
git add docs/chat-error-notifications-verification.md docs/challenge-context.md docs/challenge-acceptance.md docs/superpowers/plans/2026-11-10-chat-error-notifications.md docs/superpowers/specs/2026-11-10-chat-error-notifications-design.md
git commit -m "docs: record chat error notification evidence"
```
