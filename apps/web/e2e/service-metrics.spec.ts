import { expect, test } from '@playwright/test';
import { startFreshConversation } from './employee-chat';

test('employee confirmation persists a resolution and the login displays real aggregates', async ({
  page,
}) => {
  await page.goto('/');
  const indicators = page.getByLabel('Indicadores de atendimento', { exact: true });
  await expect(indicators.locator('.intro-highlights span')).toHaveText([
    'primeira resposta, em média',
    'resolvidos sem fila',
    'analistas online agora',
  ]);
  await expect(indicators.locator('small, details, .metrics-caption')).toHaveCount(0);
  const before = await (await page.request.get('/api/metrics')).json();
  await page.getByLabel('E-mail corporativo').fill('bruno.lima@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await startFreshConversation(page);
  const chat = page.getByRole('region', { name: 'Conversa', exact: true });
  await chat.getByLabel('Mensagem').fill('Meu monitor está sem imagem');
  await chat.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(chat.getByRole('button', { name: 'Resolveu', exact: true })).toBeVisible();
  let releaseResolution!: () => void;
  const resolutionGate = new Promise<void>((resolve) => {
    releaseResolution = resolve;
  });
  await page.route('**/api/conversations/*/resolution', async (route) => {
    await resolutionGate;
    await route.continue();
  });
  const confirmed = page.waitForResponse(
    (response) => response.url().endsWith('/resolution') && response.request().method() === 'POST',
  );
  await chat.getByRole('button', { name: 'Resolveu', exact: true }).click();
  await expect(chat.locator('.thinking-spinner')).toHaveCount(0);
  releaseResolution();
  const result = await confirmed;
  expect(result.status()).toBe(201);
  const conversation = await result.json();
  await expect(chat.getByText('Atendimento encerrado.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Atendimento encerrado.', { exact: true })).toBeVisible();
  const after = await (await page.request.get('/api/metrics')).json();
  expect(after.resolvedWithoutQueue).toBe(before.resolvedWithoutQueue + 1);
  expect(after.concludedConversations).toBe(before.concludedConversations + 1);
  expect(after.responseSamples).toBe(before.responseSamples); // CI replies are explicitly simulated.
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(
    after.resolutionPercent,
  );
  await expect(indicators.locator('strong').nth(1)).toHaveText(`${percent}%`);
  expect(conversation.state).toBe('closed');
});

test('analyst presence follows a visible authenticated session and disappears on logout', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('rafael.lima@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('demo');
  const presence = page.waitForResponse((response) => response.url().endsWith('/session/presence'));
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  expect((await presence).status()).toBe(204);
  const online = (await (await page.request.get('/api/metrics')).json()).onlineAnalysts;
  expect(online).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  const indicators = page.getByLabel('Indicadores de atendimento', { exact: true });
  const offline = (await (await page.request.get('/api/metrics')).json()).onlineAnalysts;
  expect(offline).toBeLessThan(online);
  await expect(
    indicators
      .locator('.intro-highlights > div')
      .nth(2)
      .getByText(String(offline), { exact: true }),
  ).toBeVisible();
});

test('login metrics recover from failure and distinguish an empty sample from zero', async ({
  page,
}) => {
  await page.clock.install();
  let unavailable = true;
  await page.route('**/api/metrics', async (route) => {
    if (unavailable) return route.fulfill({ status: 503, json: {} });
    return route.fulfill({
      json: {
        firstResponseSeconds: null,
        responseSamples: 0,
        resolutionPercent: null,
        resolvedWithoutQueue: 0,
        concludedConversations: 0,
        onlineAnalysts: 0,
        generatedAt: new Date().toISOString(),
      },
    });
  });
  await page.goto('/');
  const indicators = page.getByLabel('Indicadores de atendimento', { exact: true });
  await expect(indicators.getByText('Indicadores indisponíveis no momento.')).toBeVisible();
  await expect(indicators.locator('strong').filter({ hasText: '8 s' })).toHaveCount(0);
  unavailable = false;
  await indicators.getByRole('button', { name: 'Atualizar indicadores' }).click();
  await expect(indicators.locator('strong')).toHaveText(['—', '—', '0']);
  unavailable = true;
  await page.clock.fastForward(15_000);
  await expect(indicators.getByText('Indicadores indisponíveis no momento.')).toBeVisible();
  await expect(indicators.locator('strong')).toHaveText(['—', '—', '—']);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
