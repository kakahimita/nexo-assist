import { expect, test } from '@playwright/test';

test('B01 B13: login, persist, logout and isolate history', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('qualquer');
  await page.getByLabel('Senha', { exact: true }).press('Enter');
  const creation = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/conversations') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  const conversationId = (await (await creation).json()).id as string;
  await page.getByLabel('Mensagem').fill('Minha conexão caiu');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(page.getByText('Minha conexão caiu')).toBeVisible();
  await page.reload();
  const conversations = (await (await page.request.get('/api/conversations')).json()) as Array<{
    id: string;
  }>;
  const index = conversations.findIndex((conversation) => conversation.id === conversationId);
  expect(index).toBeGreaterThanOrEqual(0);
  await page.getByRole('button', { name: `Conversa ${index + 1}`, exact: true }).click();
  await expect(page.getByText('Minha conexão caiu')).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.getByLabel('E-mail corporativo').fill('bruno.lima@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Minha conexão caiu')).toHaveCount(0);
});

test('B01: reports rejected login and unavailable service', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('desconhecido@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Não foi possível entrar' }),
  ).toBeVisible();
  await page.route('**/api/session', (route) => route.fulfill({ status: 503 }));
  const retryResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/session') && response.status() === 503,
  );
  await page.getByRole('button', { name: 'Entrar' }).click();
  await retryResponse;
  await expect(
    page.getByRole('alert').filter({ hasText: 'Não foi possível entrar' }),
  ).toBeVisible();
});

test('B01: unavailable session service offers retry', async ({ page }) => {
  await page.route('**/api/session', (route) => route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Não foi possível verificar' }),
  ).toBeVisible();
  await page.unroute('**/api/session');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByLabel('E-mail corporativo')).toBeVisible();
});

test('B13: a late history response cannot change the selected conversation', async ({ page }) => {
  const timestamp = '2026-10-31T00:00:00.000Z';
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { id: 'user', name: 'Ana', email: 'ana.souza@nexo.com.br', role: 'employee' },
    }),
  );
  await page.route('**/api/tickets', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/conversations', (route) =>
    route.fulfill({
      json: [
        { id: 'one', createdAt: timestamp },
        { id: 'two', createdAt: timestamp },
      ],
    }),
  );
  await page.route('**/api/conversations/*/draft-proposals', (route) =>
    route.fulfill({ json: [] }),
  );
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/conversations/*/messages', async (route) => {
    const first = route.request().url().includes('/one/');
    if (first) await gate;
    await route.fulfill({
      json: [
        {
          id: first ? 'a' : 'b',
          content: first ? 'Primeira conversa' : 'Segunda conversa',
          createdAt: timestamp,
          role: 'employee',
          status: 'completed',
          decision: null,
        },
      ],
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Conversa 1' }).click();
  await page.getByRole('button', { name: 'Conversa 2' }).click();
  await expect(page.getByText('Segunda conversa')).toBeVisible();
  const lateResponse = page.waitForResponse((response) => response.url().includes('/one/messages'));
  release();
  await lateResponse;
  await expect(page.getByText('Segunda conversa')).toBeVisible();
  await expect(page.getByText('Primeira conversa')).toHaveCount(0);
});

test('B13: pending message cannot be submitted twice or edited', async ({ page }) => {
  const timestamp = '2026-10-31T00:00:00.000Z';
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { id: 'user', name: 'Ana', email: 'ana.souza@nexo.com.br', role: 'employee' },
    }),
  );
  await page.route('**/api/tickets', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/conversations', (route) =>
    route.fulfill({ json: [{ id: 'one', createdAt: timestamp }] }),
  );
  await page.route('**/api/conversations/*/draft-proposals', (route) =>
    route.fulfill({ json: [] }),
  );
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let posts = 0;
  await page.route('**/api/conversations/one/messages', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/conversations/one/messages/stream', async (route) => {
    posts++;
    await gate;
    const message = {
      id: 'a',
      content: 'Olá',
      createdAt: timestamp,
      role: 'employee',
      status: 'completed',
      decision: null,
    };
    await route.fulfill({
      status: 201,
      contentType: 'text/event-stream',
      body: `data: ${JSON.stringify({ type: 'user-message', message })}\n\ndata: ${JSON.stringify({ type: 'done', message })}\n\n`,
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Conversa 1' }).click();
  await page.getByLabel('Mensagem').fill('Olá');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(page.getByRole('button', { name: 'Enviar mensagem' })).toBeDisabled();
  await expect(page.getByLabel('Mensagem')).toBeDisabled();
  expect(posts).toBe(1);
  release();
  await expect(page.getByRole('button', { name: 'Enviar mensagem' })).toBeEnabled();
});
