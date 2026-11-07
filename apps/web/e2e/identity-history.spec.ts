import { expect, test } from '@playwright/test';
import { startFreshConversation } from './employee-chat';

test('V03: first visit opens the chat with permanent conversation actions', async ({ page }) => {
  const conversation = {
    id: 'first',
    createdAt: '2026-11-05T12:00:00.000Z',
    state: 'agent',
    stateVersion: 0,
    handoff: null,
    assignedAnalystId: null,
    closedAt: null,
    flow: { mode: 'none', stage: 'idle', facts: {} },
  };
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { id: 'user', name: 'Ana', email: 'ana.souza@nexo.com.br', role: 'employee' },
    }),
  );
  await page.route('**/api/conversations', (route) =>
    route.fulfill({
      status: route.request().method() === 'POST' ? 201 : 200,
      json: route.request().method() === 'POST' ? conversation : [],
    }),
  );
  await page.route('**/api/conversations/first/messages', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/conversations/first/draft-proposals', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Minhas conversas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova conversa' })).toBeVisible();
});

test('V03: employee opens the conversations dashboard and restores a selected chat', async ({
  page,
}) => {
  const conversation = {
    id: 'dashboard-conversation',
    createdAt: '2026-11-07T12:00:00.000Z',
    state: 'agent',
    stateVersion: 0,
    handoff: null,
    assignedAnalystId: null,
    closedAt: null,
    flow: { mode: 'none', stage: 'idle', facts: {} },
    latestMessage: {
      content: 'Meu notebook não liga.',
      createdAt: '2026-11-07T12:01:00.000Z',
      role: 'employee',
    },
    contextTicketNumber: 'INC-20393',
  };
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { id: 'user', name: 'Ana', email: 'ana.souza@nexo.com.br', role: 'employee' },
    }),
  );
  await page.route('**/api/ready', (route) =>
    route.fulfill({ json: { status: 'ok', service: 'nexo-api', database: 'ready' } }),
  );
  await page.route('**/api/conversations', (route) => route.fulfill({ json: [conversation] }));
  await page.route('**/api/conversations/dashboard-conversation/messages', (route) =>
    route.fulfill({
      json: [
        {
          id: 'message-1',
          content: 'Meu notebook não liga.',
          createdAt: '2026-11-07T12:01:00.000Z',
          role: 'employee',
          status: 'completed',
          decision: null,
          authorName: null,
        },
      ],
    }),
  );
  await page.route('**/api/conversations/dashboard-conversation/draft-proposals', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/tickets', (route) =>
    route.fulfill({
      json: [
        {
          id: 'ticket-1',
          number: 'INC-20393',
          ownerId: 'user',
          title: 'Notebook não liga',
          description: 'A tela permanece apagada ao iniciar.',
          type: 'INC',
          category: 'hardware',
          priority: 'high',
          impact: 'self',
          status: 'open',
          transferRequested: false,
          createdAt: '2026-11-07T12:00:00.000Z',
          resolvedAt: null,
          slaStartedAt: '2026-11-07T12:00:00.000Z',
          deadline: '2026-11-07T16:00:00.000Z',
          overdue: false,
        },
      ],
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Minhas conversas' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova conversa' })).toBeVisible();
  await page.getByRole('button', { name: 'Minhas conversas' }).click();
  await expect(page.getByRole('heading', { name: 'Minhas conversas' })).toBeVisible();
  await expect(page.getByText('Notebook não liga', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Meu notebook não liga/ }).click();
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toBeVisible();
  await expect(page.getByText('Meu notebook não liga.', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Minhas conversas' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
});

test('V03: employee cannot start a permanent new conversation while human support owns one', async ({
  page,
}) => {
  const conversation = {
    id: 'paused-conversation',
    createdAt: '2026-11-07T12:00:00.000Z',
    state: 'waiting_for_analyst',
    stateVersion: 1,
    handoff: {
      reason: 'employee_request',
      summary: 'Aguardando atendimento humano.',
      requestedAt: '2026-11-07T12:01:00.000Z',
    },
    assignedAnalystId: null,
    closedAt: null,
    flow: { mode: 'none', stage: 'idle', facts: {} },
    latestMessage: null,
    contextTicketNumber: null,
  };
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: { id: 'user', name: 'Ana', email: 'ana.souza@nexo.com.br', role: 'employee' },
    }),
  );
  await page.route('**/api/ready', (route) =>
    route.fulfill({ json: { status: 'ok', service: 'nexo-api', database: 'ready' } }),
  );
  await page.route('**/api/conversations', (route) => route.fulfill({ json: [conversation] }));
  await page.route('**/api/conversations/paused-conversation/messages', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/conversations/paused-conversation/draft-proposals', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Nova conversa', exact: true })).toBeDisabled();
});

test('B01 B13: login, persist, logout and isolate history', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('qualquer');
  await page.getByLabel('Senha', { exact: true }).press('Enter');
  const conversationId = await startFreshConversation(page);
  await page.getByLabel('Mensagem').fill('Minha conexão caiu');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Minha conexão caiu')).toBeVisible();
  await page.reload();
  const conversations = (await (await page.request.get('/api/conversations')).json()) as Array<{
    id: string;
  }>;
  const index = conversations.findIndex((conversation) => conversation.id === conversationId);
  expect(index).toBeGreaterThanOrEqual(0);
  expect(conversations.at(-1)?.id).toBe(conversationId);
  await expect(page.getByText('Minha conexão caiu')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Conversas' })).toHaveCount(0);
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

test('B13 V03: the latest conversation resumes without exposing a history list', async ({
  page,
}) => {
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
        {
          id: 'one',
          createdAt: timestamp,
          state: 'agent',
          stateVersion: 0,
          handoff: null,
          assignedAnalystId: null,
          closedAt: null,
          flow: { mode: 'none', stage: 'idle', facts: {} },
        },
        {
          id: 'two',
          createdAt: timestamp,
          state: 'agent',
          stateVersion: 0,
          handoff: null,
          assignedAnalystId: null,
          closedAt: null,
          flow: { mode: 'none', stage: 'idle', facts: {} },
        },
      ],
    }),
  );
  await page.route('**/api/conversations/*/draft-proposals', (route) =>
    route.fulfill({ json: [] }),
  );
  let requestedOlder = false;
  await page.route('**/api/conversations/*/messages', async (route) => {
    const first = route.request().url().includes('/one/');
    if (first) requestedOlder = true;
    await route.fulfill({
      json: [
        {
          id: first ? 'a' : 'b',
          content: first ? 'Primeira conversa' : 'Segunda conversa',
          createdAt: timestamp,
          role: 'employee',
          status: 'completed',
          decision: null,
          authorName: null,
        },
      ],
    });
  });
  await page.goto('/');
  await expect(page.getByText('Segunda conversa')).toBeVisible();
  expect(requestedOlder).toBe(false);
  await expect(page.getByRole('navigation', { name: 'Conversas' })).toHaveCount(0);
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
    route.fulfill({
      json: [
        {
          id: 'one',
          createdAt: timestamp,
          state: 'agent',
          stateVersion: 0,
          handoff: null,
          assignedAnalystId: null,
          closedAt: null,
          flow: { mode: 'none', stage: 'idle', facts: {} },
        },
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
      authorName: null,
    };
    await route.fulfill({
      status: 201,
      contentType: 'text/event-stream',
      body: `data: ${JSON.stringify({ type: 'user-message', message })}\n\ndata: ${JSON.stringify({ type: 'done', message })}\n\n`,
    });
  });
  await page.goto('/');
  await page.getByLabel('Mensagem').fill('Olá');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enviar', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Mensagem')).toBeDisabled();
  expect(posts).toBe(1);
  release();
  await expect(page.getByRole('button', { name: 'Enviar', exact: true })).toBeEnabled();
});
