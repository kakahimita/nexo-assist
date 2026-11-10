import { expect, request, test } from '@playwright/test';
import { startFreshConversation } from './employee-chat';
async function start(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await startFreshConversation(page);
}
async function send(page: import('@playwright/test').Page, text: string) {
  await page.getByLabel('Mensagem').fill(text);
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
}
test('B02 B12: asks platform and exposes actual decision evidence', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  const chat = page.getByRole('region', { name: 'Conversa' });
  const ticketsBefore = await (await page.request.get('/api/tickets')).json();
  await send(page, 'Meu notebook não conecta na VPN e mostra o erro 809');
  await expect(chat.getByText('Qual versão do Windows?')).toBeVisible();
  await page.screenshot({ path: 'outputs/consultation-desktop.png', fullPage: true });
  await expect(chat.getByText('Consulta de chamados')).toBeVisible();
  await expect(chat.getByText('Busca na base de conhecimento')).toBeVisible();
  await chat.getByRole('button', { name: 'Windows 11' }).focus();
  await page.keyboard.press('Enter');
  await expect(chat.getByText(/VPN erro 809 no Windows 11/).first()).toBeVisible();
  await expect(chat.getByText(/Reinstale o cliente VPN/i)).toHaveCount(0);
  await chat.getByText('Detalhes da decisão').last().click();
  await expect(chat.getByText(/Confiança estimada/).last()).toBeVisible();
  await expect(chat.getByText(/Compatibilidade com a versão do Windows/).last()).toBeVisible();
  expect(await (await page.request.get('/api/tickets')).json()).toEqual(ticketsBefore);
});
test('B09 B10: a paused conversation blocks a new session until human support returns it', async ({
  page,
}) => {
  await start(page);
  const chat = page.getByRole('region', { name: 'Conversa' });
  const waiting = async () =>
    (
      (await (await page.request.get('/api/conversations')).json()) as Array<{ state: string }>
    ).filter((item) => item.state === 'waiting_for_analyst').length;
  const waitingBefore = await waiting();
  await expect(page.getByRole('button', { name: 'Iniciar nova conversa' })).toHaveCount(0);
  await send(page, 'Qual o status do meu chamado?');
  const choices = chat.getByRole('group', { name: 'Chamados encontrados' }).last();
  await choices.getByRole('button', { name: /Notebook lento/ }).click();
  await expect(chat.getByRole('status')).toContainText('Aguardando atendimento humano');
  await expect(page.getByRole('button', { name: 'Iniciar nova conversa' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Nova conversa', exact: true })).toBeDisabled();
  const rejected = await page.evaluate(async () => {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    return response.status;
  });
  expect(rejected).toBe(409);

  const conversations = (await (await page.request.get('/api/conversations')).json()) as Array<{
    id: string;
    state: string;
  }>;
  expect(conversations.filter((item) => item.state === 'waiting_for_analyst')).toHaveLength(
    waitingBefore + 1,
  );
  const paused = conversations.find((item) => item.state === 'waiting_for_analyst');
  expect(paused).toBeDefined();
  const baseURL = new URL(page.url()).origin;
  const analyst = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  });
  try {
    await analyst
      .post('/api/session', { data: { email: 'analista@nexo.com.br', password: 'x' } })
      .then((response) => expect(response.status()).toBe(201));
    await analyst
      .post(`/api/support/conversations/${paused?.id}/claim`)
      .then((response) => expect(response.status()).toBe(201));
    await analyst
      .post(`/api/support/conversations/${paused?.id}/return`)
      .then((response) => expect(response.status()).toBe(201));
  } finally {
    await analyst.dispose();
  }
});

test('B03 B16: selects own tickets and redirects RH', async ({ page }) => {
  await start(page);
  const chat = page.getByRole('region', { name: 'Conversa' });
  await send(page, 'Qual o status do meu chamado?');
  const choices = chat.getByRole('group', { name: 'Chamados encontrados' }).last();
  await expect(choices.getByRole('button', { name: /Notebook lento/ })).toBeVisible();
  await expect(choices.getByRole('button', { name: /Senha bloqueada/ })).toBeVisible();
  await choices.getByRole('button', { name: /Notebook lento/ }).click();
  await expect(chat.getByRole('status')).toContainText('Aguardando atendimento humano');
  await startFreshConversation(page);
  await send(page, 'INC-99999');
  await expect(chat.getByText(/Qual chamado você deseja consultar/).last()).toBeVisible();
  await send(page, 'Como solicitar férias no RH?');
  await expect(chat.getByText(/apenas com assuntos de TI/).last()).toBeVisible();
});
test('mobile chat does not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await send(page, 'Meu notebook não conecta na VPN e mostra o erro 809');
  await expect(page.getByText('Qual versão do Windows?')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'outputs/consultation-mobile.png', fullPage: true });
});
test('B12 B15: failed turn stays failed after reloading history', async ({ page }) => {
  await start(page);
  const timestamp = '2026-11-02T12:00:00.000Z';
  const user = {
    id: 'user-test',
    content: 'VPN',
    createdAt: timestamp,
    role: 'employee',
    status: 'completed',
    decision: null,
    authorName: null,
  };
  const agent = {
    id: 'agent-test',
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
      errorCode: 'quota',
      source: 'deterministic',
    },
  };
  await page.route('**/api/conversations/*/messages/stream', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'text/event-stream',
      body: [
        { type: 'user-message', message: user },
        { type: 'error', code: 'quota' },
        { type: 'done', message: agent },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\n\n`)
        .join(''),
    }),
  );
  await send(page, 'VPN');
  const chat = page.getByRole('region', { name: 'Conversa' });
  await expect(chat.getByRole('alert').first()).toContainText('limite do modelo');
  await expect(chat.locator('.consultation-actions .succeeded')).toHaveCount(0);
  await page.route('**/api/conversations/*/messages', (route) =>
    route.fulfill({ json: [user, agent] }),
  );
  await page.reload();
  await expect(page.getByRole('region', { name: 'Conversa' }).getByRole('alert')).toContainText(
    'limite do modelo',
  );
});
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
  await expect(chat.getByText('Preparando resposta')).toBeAttached();
  release();
  await expect(chat.getByText('Resposta pronta.', { exact: true }).last()).toBeVisible();
  await expect(page.locator('.thinking-spinner')).toHaveCount(0);
  await expect(chat.getByText('Preparando resposta')).toHaveCount(0);
});
