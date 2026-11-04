import { expect, test } from '@playwright/test';

async function loginAsAnalyst(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('analista@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('B11 V04: announces queue loading without presenting it as empty', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/support/conversations?filter=waiting', async (route) => {
    await pending;
    await route.fulfill({ json: [] });
  });

  await loginAsAnalyst(page);

  await expect(page.getByText('Carregando conversas…')).toBeVisible();
  await expect(page.getByText('Nenhuma conversa.')).toHaveCount(0);

  release();
  await expect(page.getByText('Nenhuma conversa neste filtro.')).toBeVisible();
});

test('B11: retries a failed queue request without treating it as empty', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/support/conversations?filter=waiting', async (route) => {
    requests += 1;
    await route.fulfill({ status: requests === 1 ? 500 : 200, json: [] });
  });

  await loginAsAnalyst(page);

  await expect(page.getByText('Não foi possível carregar as conversas.')).toBeVisible();
  await expect(page.getByText('Nenhuma conversa neste filtro.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Nenhuma conversa neste filtro.')).toBeVisible();
  await expect(page.getByText('Não foi possível carregar as conversas.')).toHaveCount(0);
  expect(requests).toBe(2);
});

test('B11: ignores an older filter response after the analyst changes filters', async ({ page }) => {
  const summary = (id: string, name: string) => ({
    id,
    state: 'waiting_for_analyst',
    stateVersion: 0,
    employee: { id: `${id}-employee`, name },
    handoff: null,
    assignedAnalystId: null,
    closedAt: null,
    lastMessage: null,
  });
  let releaseWaiting!: () => void;
  const waiting = new Promise<void>((resolve) => {
    releaseWaiting = resolve;
  });
  await page.route('**/api/support/conversations?filter=waiting', async (route) => {
    await waiting;
    await route.fulfill({ json: [summary('waiting', 'Fila antiga')] });
  });
  await page.route('**/api/support/conversations?filter=owned', async (route) => {
    await route.fulfill({ json: [summary('owned', 'Fila atual')] });
  });

  await loginAsAnalyst(page);
  await page.getByRole('button', { name: 'Minhas' }).click();
  await expect(page.getByText('Fila atual')).toBeVisible();
  releaseWaiting();
  await expect(page.getByText('Fila antiga')).toHaveCount(0);
});
