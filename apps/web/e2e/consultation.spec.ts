import { expect, test } from '@playwright/test';
async function start(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Nova conversa' }).click();
}
async function send(page: import('@playwright/test').Page, text: string) {
  await page.getByLabel('Mensagem').fill(text);
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
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
test('B03 B16: selects own tickets and redirects RH', async ({ page }) => {
  await start(page);
  const chat = page.getByRole('region', { name: 'Conversa' });
  await send(page, 'Qual o status do meu chamado?');
  await expect(chat.getByRole('button', { name: /Notebook lento/ }).last()).toBeVisible();
  await expect(chat.getByRole('button', { name: /Senha bloqueada/ }).last()).toBeVisible();
  await chat
    .getByRole('button', { name: /Notebook lento/ })
    .last()
    .click();
  await expect(chat.getByRole('status')).toContainText('Aguardando atendimento humano');
  const creation = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/conversations') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  await creation;
  await expect(page.getByRole('button', { name: 'Nova conversa' })).toBeEnabled();
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
  await page
    .getByRole('button', { name: /Conversa/ })
    .last()
    .click();
  await expect(page.getByRole('region', { name: 'Conversa' }).getByRole('alert')).toContainText(
    'limite do modelo',
  );
});
