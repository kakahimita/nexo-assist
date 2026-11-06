import { expect, type Page } from '@playwright/test';

export async function startFreshConversation(page: Page): Promise<string> {
  await expect(page.getByRole('region', { name: 'Conversa' })).toBeVisible();
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((cookie) => cookie.name === 'nexo_session'),
    )
    .toBe(true);
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
