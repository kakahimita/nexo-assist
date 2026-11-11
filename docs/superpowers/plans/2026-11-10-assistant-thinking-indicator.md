# Assistant Thinking Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an accessible compact spinner between sending an employee message and the first streamed assistant fragment, and remove it on every terminal event.

**Architecture:** `Consultation` gains an `awaitingReply` state set by `send()` and cleared by the first `text-delta`, `done`, `handoff-waiting`, `error`, and `finally`. The transient agent bubble renders a decorative spinner plus a persistent polite status announcement; `globals.css` supplies the spinner and reduced-motion style. Chromium tests gate the stream to observe the state deterministically.

**Tech Stack:** TypeScript, React/Next.js 16, CSS, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-10-assistant-thinking-indicator-design.md`

## Global Constraints

- Issue #65 branch: `feature/LAB-0065`; do not merge without explicit owner instruction.
- User-facing copy is Brazilian Portuguese; engineering artifacts are English.
- Do not change streaming, orchestration, handoff, draft, session-limit, or resolution behavior.
- Do not show the indicator during resolution confirmation.
- Keep the indicator out of the way of messages, handoff banners, and failures.
- `apps/web/AGENTS.md` requires reading the relevant local Next.js guide before editing web code.

## Review Focus

- A stream that stays open before its first fragment must keep the spinner visible and the composer disabled, then clear it when text arrives.
- A stream that fails or hands off before text must clear the spinner while keeping the alert or handoff banner visible.
- Resolution confirmation is not a message turn and must never show the spinner.
- Every new send or quick reply sets the state again, and every terminal stream event clears it.
- Reduced-motion users must receive a static indicator, and screen readers must hear the waiting state once.

---

### Task 1: Add the thinking indicator and its browser coverage

**Files:**
- Modify: `apps/web/src/features/consultation/consultation.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/e2e/consultation.spec.ts`
- Modify: `apps/web/e2e/autonomous-resolution.spec.ts`
- Modify: `apps/web/e2e/service-metrics.spec.ts`

**Interfaces:**
- Produces component state `awaitingReply: boolean` inside `Consultation`; it stays internal.
- Produces CSS classes `.thinking` and `.thinking-spinner`.
- Consumes the existing `send()` and stream event names from `consultation.tsx`.

- [ ] **Step 1: Read the local Next.js guides required by `apps/web/AGENTS.md`**

Read `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` and
`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`
before touching the web sources.

- [ ] **Step 2: Write the failing browser test for appearance and first-fragment cleanup**

Add to `apps/web/e2e/consultation.spec.ts`:

```ts
test('#65 B12: shows a thinking indicator until the first streamed fragment', async ({ page }) => {
  await start(page);
  const chat = page.getByRole('region', { name: 'Conversa' });
  const timestamp = '2026-11-10T12:00:00.000Z';
  const user = {
    id: 'user-thinking',
    content: 'VPN',
    createdAt: timestamp,
    role: 'employee',
    status: 'completed',
    decision: null,
    authorName: null,
  };
  const agent = {
    id: 'agent-thinking',
    content: 'Resposta pronta.',
    createdAt: timestamp,
    role: 'agent',
    status: 'completed',
    authorName: null,
    decision: {
      intent: 'Consulta',
      action: 'answer',
      appliedRule: 'Base',
      confidence: 0.8,
      justification: 'Artigo aplicável',
      missingFacts: [],
      quickReplies: [],
      actions: [],
      evidence: [],
      tickets: [],
      outcome: 'completed',
      errorCode: null,
      source: 'deterministic',
    },
  };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/conversations/*/messages/stream', async (route) => {
    await gate;
    await route.fulfill({
      status: 201,
      contentType: 'text/event-stream',
      body: [
        { type: 'user-message', message: user },
        { type: 'text-delta', text: 'Resposta pronta.' },
        { type: 'done', message: agent },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(''),
    });
  });
  await send(page, 'VPN');
  await expect(page.locator('.thinking-spinner')).toBeVisible();
  await expect(chat.getByRole('status').filter({ hasText: 'Preparando resposta' })).toBeAttached();
  release();
  await expect(chat.getByText('Resposta pronta.', { exact: true }).last()).toBeVisible();
  await expect(page.locator('.thinking-spinner')).toHaveCount(0);
  await expect(chat.getByRole('status').filter({ hasText: 'Preparando resposta' })).toHaveCount(0);
});
```

- [ ] **Step 3: Add cleanup assertions to existing browser tests**

In `apps/web/e2e/autonomous-resolution.spec.ts`, next to the existing
`Preparando resposta...` assertion after handoff, add:

```ts
await expect(chat.locator('.thinking-spinner')).toHaveCount(0);
```

In `apps/web/e2e/service-metrics.spec.ts`, gate the resolution request so the
pending state is observable:

```ts
let releaseResolution!: () => void;
const resolutionGate = new Promise<void>((resolve) => {
  releaseResolution = resolve;
});
await page.route('**/api/conversations/*/resolution', async (route) => {
  await resolutionGate;
  await route.continue();
});
```

Place the route before the `Resolveu` click. After the click and before
`const result = await confirmed;`, add:

```ts
await expect(chat.locator('.thinking-spinner')).toHaveCount(0);
releaseResolution();
```

- [ ] **Step 4: Build and run the targeted browser test to verify failure**

Run:

```bash
npm run build
E2E_WEB_PORT=3100 E2E_API_PORT=3101 npm run test:e2e -- apps/web/e2e/consultation.spec.ts --grep "thinking indicator"
```

Expected: FAIL because `.thinking-spinner` does not exist yet.

- [ ] **Step 5: Implement `awaitingReply` and the transient bubble**

In `apps/web/src/features/consultation/consultation.tsx`:

1. Add `const [awaitingReply, setAwaitingReply] = useState(false);` next to
   `active`.
2. In `send()`, call `setAwaitingReply(true)` beside `setActive(true)`.
3. In the stream callback, call `setAwaitingReply(false)` for `text-delta`,
   `handoff-waiting`, `error`, and `done` before their other state updates.
4. In `send()`'s `finally`, call `setAwaitingReply(false)` beside
   `setActive(false)`.
5. Replace the transient bubble condition
   `{active && (...)}` with `{active && (awaitingReply || partial) && (...)}`.
   Inside `.chat-message-bubble`, render `<div className="thinking"
   aria-hidden="true"><span className="thinking-spinner" /></div>` when
   `awaitingReply`, otherwise the existing `<p>{partial}</p>`.
6. Add a persistent announcement near the top of the section:
   `<p className="visually-hidden" role="status">{awaitingReply ? 'Preparando resposta' : ''}</p>`.
   Do not duplicate that text inside the spinner bubble.

Do not call `setAwaitingReply(true)` from `confirmResolution()`.

- [ ] **Step 6: Add the spinner styles**

In `apps/web/src/app/globals.css`, next to the chat bubble rules:

```css
.thinking {
  display: flex;
  align-items: center;
  min-height: 24px;
}
.thinking-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #cbd8e6;
  border-top-color: #1b2431;
  border-radius: 50%;
  animation: thinking-spin 0.8s linear infinite;
}
@keyframes thinking-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .thinking-spinner {
    animation: none;
  }
}
```

- [ ] **Step 7: Build and run the targeted browser tests to verify success**

Run:

```bash
npm run build
E2E_WEB_PORT=3100 E2E_API_PORT=3101 npm run test:e2e -- apps/web/e2e/consultation.spec.ts apps/web/e2e/autonomous-resolution.spec.ts apps/web/e2e/service-metrics.spec.ts
```

Expected: PASS, including the new indicator test and the updated cleanup
assertions.

- [ ] **Step 8: Format and typecheck the touched sources**

Run `npm run format`, then `npm run typecheck` and `npm run lint`.
Expected: PASS with no formatting changes outside the touched files.

- [ ] **Step 9: Commit the implementation**

```bash
git add apps/web/src/features/consultation/consultation.tsx apps/web/src/app/globals.css apps/web/e2e/consultation.spec.ts apps/web/e2e/autonomous-resolution.spec.ts apps/web/e2e/service-metrics.spec.ts
git commit -m "feat: add assistant thinking indicator"
```

### Task 2: Run the full gate and record evidence

**Files:**
- Create: `docs/thinking-indicator-verification.md`
- Modify: `docs/challenge-context.md`
- Modify: `docs/challenge-acceptance.md`

**Interfaces:**
- Consumes the committed implementation from Task 1 and its test output.

- [ ] **Step 1: Run the complete repository gate**

Run `npm run check` with ports 3000/3001 free.
Expected: typecheck, lint, format check, unit tests, integration tests, build,
and all Chromium tests pass.

- [ ] **Step 2: Write `docs/thinking-indicator-verification.md`**

Record the issue, the `awaitingReply` cleanup events, the gated Chromium
scenarios (first fragment, handoff, failure, resolution confirmation),
reduced-motion behavior, the exact command results with counts, and the limits:
no original-reference visual comparison because the private bundle is absent.

- [ ] **Step 3: Update the maintained context and acceptance matrix**

Add one paragraph to `docs/challenge-context.md` linking the verification
document, and one line to the top of `docs/challenge-acceptance.md` stating that
#65 covers the transient employee waiting state and which B IDs the browser
checks demonstrate. Keep the distinction between executed evidence and planned
checks.

- [ ] **Step 4: Format and verify documentation links**

Run `npm run format:check` and `git diff --check`.
Expected: PASS.

- [ ] **Step 5: Commit the evidence**

```bash
git add docs/thinking-indicator-verification.md docs/challenge-context.md docs/challenge-acceptance.md
git commit -m "docs: record thinking indicator evidence"
```
