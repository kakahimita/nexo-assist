import { expect, request, type Page } from '@playwright/test';

type ConversationState = 'agent' | 'waiting_for_analyst' | 'with_analyst' | 'closed';

async function returnPausedConversations(page: Page): Promise<void> {
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/conversations');
    return response.ok ? response.json() : null;
  });
  if (!Array.isArray(result)) return;
  const conversations = result as Array<{
    id: string;
    state: ConversationState;
  }>;
  const paused = conversations.filter(
    (conversation) =>
      conversation.state === 'waiting_for_analyst' || conversation.state === 'with_analyst',
  );
  if (paused.length === 0) return;

  const baseURL = new URL(page.url()).origin;
  const analyst = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  });
  try {
    await analyst
      .post('/api/session', { data: { email: 'analista@nexo.com.br', password: 'x' } })
      .then((response) => expect(response.status()).toBe(201));

    for (const conversation of paused) {
      if (conversation.state === 'waiting_for_analyst') {
        await analyst
          .post(`/api/support/conversations/${conversation.id}/claim`)
          .then((response) => expect(response.status()).toBe(201));
      }
      await analyst
        .post(`/api/support/conversations/${conversation.id}/return`)
        .then((response) => expect(response.status()).toBe(201));
    }
  } finally {
    await analyst.dispose();
  }
}

export async function startFreshConversation(page: Page): Promise<string> {
  await expect(page.getByRole('region', { name: 'Conversa' })).toBeVisible();
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((cookie) => cookie.name === 'nexo_session'),
    )
    .toBe(true);
  // The E2E suite shares one temporary database. Restore only this employee's
  // paused conversations so each scenario starts from a valid agent-owned state.
  await returnPausedConversations(page);
  const created = await page.evaluate(async () => {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const body = (await response.json()) as { id?: string };
    return { status: response.status, id: body.id };
  });
  expect(created.status).toBe(201);
  const id = String(created.id);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Conversa' })).toBeVisible();
  return id;
}
