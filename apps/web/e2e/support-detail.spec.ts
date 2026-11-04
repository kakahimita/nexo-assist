import { expect, test, type Page } from '@playwright/test';

type ConversationState = 'agent' | 'waiting_for_analyst' | 'with_analyst' | 'closed';

async function loginAsAnalyst(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('analista@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
  return page.evaluate(async () => (await (await fetch('/api/session')).json()).id as string);
}

function conversation(id: string, state: ConversationState, assignedAnalystId: string | null) {
  return {
    id,
    state,
    stateVersion: 0,
    employee: { id: `${id}-employee`, name: `Pessoa ${id}` },
    handoff: null,
    assignedAnalystId,
    closedAt: state === 'closed' ? '2026-11-04T12:10:00.000Z' : null,
    lastMessage: null,
  };
}

function detail(item: ReturnType<typeof conversation>) {
  return { conversation: item, messages: [], tickets: [] };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function showQueue(page: Page, items: ReturnType<typeof conversation>[]) {
  await page.getByRole('button', { name: 'Todas' }).click();
  await page.getByRole('button', { name: 'Para você' }).click();
  for (const item of items) {
    await expect(page.locator(`[data-conversation-id="${item.id}"]`)).toBeVisible();
  }
}

test('B11 V05: controls reflect the selected conversation ownership', async ({ page }) => {
  let items: ReturnType<typeof conversation>[] = [];
  await page.route('**/api/support/conversations?filter=waiting', (route) =>
    route.fulfill({ json: items }),
  );
  await page.route('**/api/support/conversations?filter=all', (route) =>
    route.fulfill({ json: items }),
  );
  await page.route('**/api/support/conversations/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    return route.fulfill({ json: detail(items.find((item) => item.id === id)!) });
  });

  const analystId = await loginAsAnalyst(page);
  items = [
    conversation('waiting', 'waiting_for_analyst', null),
    conversation('owned', 'with_analyst', analystId),
    conversation('another', 'with_analyst', 'other-analyst'),
    conversation('agent', 'agent', null),
    conversation('closed', 'closed', null),
  ];
  await showQueue(page, items);
  const region = page.getByRole('region', { name: 'Atendimento' });

  await page.locator('[data-conversation-id="waiting"]').click();
  await expect(region.getByRole('status')).toHaveText('Aguardando atendente');
  await expect(region.getByRole('button', { name: 'Assumir atendimento' })).toBeVisible();
  await expect(region.getByRole('button', { name: /Enviar|Devolver|Encerrar/ })).toHaveCount(0);

  await page.locator('[data-conversation-id="owned"]').click();
  await expect(region.getByRole('status')).toHaveText('Você está atendendo');
  await expect(region.getByLabel('Resposta')).toBeVisible();
  await expect(region.getByRole('button', { name: 'Enviar resposta' })).toBeVisible();
  await expect(region.getByRole('button', { name: 'Devolver ao agente' })).toBeVisible();
  await expect(region.getByRole('button', { name: 'Encerrar atendimento' })).toBeVisible();

  for (const [id, label] of [
    ['another', 'Em atendimento por outro analista'],
    ['agent', 'Com o agente'],
    ['closed', 'Atendimento encerrado'],
  ] as const) {
    await page.locator(`[data-conversation-id="${id}"]`).click();
    await expect(region.getByRole('status')).toHaveText(label);
    await expect(
      region.getByRole('button', { name: /Assumir|Enviar|Devolver|Encerrar/ }),
    ).toHaveCount(0);
  }
});

test('B11: a late detail success cannot replace a newer selection', async ({ page }) => {
  const first = deferred();
  const firstStarted = deferred();
  let items: ReturnType<typeof conversation>[] = [];
  await page.route('**/api/support/conversations?filter=waiting', (route) =>
    route.fulfill({ json: items }),
  );
  await page.route('**/api/support/conversations?filter=all', (route) =>
    route.fulfill({ json: items }),
  );
  await page.route('**/api/support/conversations/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const item = items.find((candidate) => candidate.id === id)!;
    if (id === 'a') {
      firstStarted.resolve();
      await first.promise;
    }
    await route.fulfill({ json: detail(item) });
  });

  const analystId = await loginAsAnalyst(page);
  items = [
    conversation('a', 'with_analyst', analystId),
    conversation('b', 'with_analyst', analystId),
  ];
  await showQueue(page, items);
  const region = page.getByRole('region', { name: 'Atendimento' });

  await page.locator('[data-conversation-id="a"]').click();
  await firstStarted.promise;
  await page.locator('[data-conversation-id="b"]').click();
  await expect(region.getByRole('status')).toHaveText('Você está atendendo');
  await expect(region).toContainText('Pessoa b');

  first.resolve();
  await expect(region).toContainText('Pessoa b');
  await expect(region).not.toContainText('Pessoa a');
});

test('B11: a late detail error cannot replace a newer selection', async ({ page }) => {
  const first = deferred();
  const firstStarted = deferred();
  let items: ReturnType<typeof conversation>[] = [];
  await page.route('**/api/support/conversations?filter=waiting', (route) =>
    route.fulfill({ json: items }),
  );
  await page.route('**/api/support/conversations?filter=all', (route) =>
    route.fulfill({ json: items }),
  );
  await page.route('**/api/support/conversations/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    if (id === 'a') {
      firstStarted.resolve();
      await first.promise;
      await route.fulfill({ status: 500 });
      return;
    }
    await route.fulfill({ json: detail(items.find((candidate) => candidate.id === id)!) });
  });

  const analystId = await loginAsAnalyst(page);
  items = [
    conversation('a', 'with_analyst', analystId),
    conversation('b', 'with_analyst', analystId),
  ];
  await showQueue(page, items);
  const region = page.getByRole('region', { name: 'Atendimento' });

  await page.locator('[data-conversation-id="a"]').click();
  await firstStarted.promise;
  await page.locator('[data-conversation-id="b"]').click();
  await expect(region).toContainText('Pessoa b');

  first.resolve();
  await expect(region).toContainText('Pessoa b');
  await expect(page.getByText('Não foi possível carregar a conversa.')).toHaveCount(0);
});

test('B11: loading a new selection hides the previous detail and failed loads retry that id', async ({
  page,
}) => {
  let mode: 'waiting' | 'fail' | 'ok' = 'waiting';
  const pending = deferred();
  const pendingStarted = deferred();
  let items: ReturnType<typeof conversation>[] = [];
  await page.route('**/api/support/conversations?filter=waiting', (route) =>
    route.fulfill({ json: items }),
  );
  await page.route('**/api/support/conversations?filter=all', (route) =>
    route.fulfill({ json: items }),
  );
  const requested: string[] = [];
  await page.route('**/api/support/conversations/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    requested.push(id);
    if (id === 'a') {
      await route.fulfill({ json: detail(items.find((item) => item.id === 'a')!) });
      return;
    }
    if (mode === 'waiting') {
      pendingStarted.resolve();
      await pending.promise;
      mode = 'fail';
      await route.fulfill({ status: 500 });
      return;
    }
    if (mode === 'fail') {
      await route.fulfill({ status: 500 });
      return;
    }
    await route.fulfill({ json: detail(items.find((item) => item.id === 'b')!) });
  });

  const analystId = await loginAsAnalyst(page);
  items = [
    conversation('a', 'with_analyst', analystId),
    conversation('b', 'with_analyst', analystId),
  ];
  await showQueue(page, items);
  const region = page.getByRole('region', { name: 'Atendimento' });

  await page.locator('[data-conversation-id="a"]').click();
  await expect(region).toContainText('Pessoa a');

  await page.locator('[data-conversation-id="b"]').click();
  await pendingStarted.promise;
  await expect(page.getByText('Carregando conversa…')).toBeVisible();
  await expect(region).toHaveCount(0);

  pending.resolve();
  await expect(page.getByText('Não foi possível carregar a conversa.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();

  mode = 'ok';
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(region).toContainText('Pessoa b');
  expect(requested.filter((id) => id === 'b')).toHaveLength(2);
  expect(requested.at(-1)).toBe('b');
});

test('B11: each conversation keeps its own unsent reply draft', async ({ page }) => {
  let items: ReturnType<typeof conversation>[] = [];
  await page.route('**/api/support/conversations?filter=waiting', (route) =>
    route.fulfill({ json: items }),
  );
  await page.route('**/api/support/conversations?filter=all', (route) =>
    route.fulfill({ json: items }),
  );
  await page.route('**/api/support/conversations/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    return route.fulfill({ json: detail(items.find((item) => item.id === id)!) });
  });

  const analystId = await loginAsAnalyst(page);
  items = [
    conversation('a', 'with_analyst', analystId),
    conversation('b', 'with_analyst', analystId),
  ];
  await showQueue(page, items);

  await page.locator('[data-conversation-id="a"]').click();
  await page.getByLabel('Resposta').fill('Rascunho da conversa A');
  await page.locator('[data-conversation-id="b"]').click();
  await page.getByLabel('Resposta').fill('Rascunho da conversa B');
  await page.locator('[data-conversation-id="a"]').click();
  await expect(page.getByLabel('Resposta')).toHaveValue('Rascunho da conversa A');
  await page.locator('[data-conversation-id="b"]').click();
  await expect(page.getByLabel('Resposta')).toHaveValue('Rascunho da conversa B');
});
