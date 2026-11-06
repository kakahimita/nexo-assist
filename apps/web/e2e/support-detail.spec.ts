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

type HandoffFixture = {
  reason: 'employee_request' | 'critical_incident' | 'overdue_ticket' | 'unresolved_uncertainty';
  summary: string;
  requestedAt: string;
};

type MessageFixture = {
  id: string;
  content: string;
  createdAt: string;
  role: 'employee' | 'agent' | 'analyst';
  status: 'completed';
  decision: null;
  authorName: string | null;
};

type TicketFixture = {
  id: string;
  number: string | null;
  ownerId: string;
  title: string;
  description: string;
  type: 'INC' | 'REQ';
  category: 'access' | 'network_vpn' | 'hardware' | 'software' | 'email' | 'other';
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: 'self' | 'team' | 'company';
  status: 'open' | 'resolved';
  transferRequested: boolean;
  createdAt: string;
  resolvedAt: string | null;
  slaStartedAt: string;
  deadline: string;
  overdue: boolean;
};

function conversation(
  id: string,
  state: ConversationState,
  assignedAnalystId: string | null,
  handoff: HandoffFixture | null = null,
): {
  id: string;
  state: ConversationState;
  stateVersion: number;
  employee: { id: string; name: string };
  handoff: HandoffFixture | null;
  assignedAnalystId: string | null;
  contextTicketId: string | null;
  closedAt: string | null;
  lastMessage: null;
} {
  return {
    id,
    state,
    stateVersion: 0,
    employee: { id: `${id}-employee`, name: `Pessoa ${id}` },
    handoff,
    assignedAnalystId,
    contextTicketId: null,
    closedAt: state === 'closed' ? '2026-11-04T12:10:00.000Z' : null,
    lastMessage: null,
  };
}

function detail(
  item: ReturnType<typeof conversation>,
  messages: MessageFixture[] = [],
  tickets: TicketFixture[] = [],
) {
  return { conversation: item, messages, tickets };
}

function message(
  id: string,
  role: MessageFixture['role'],
  content: string,
  createdAt: string,
  authorName: string | null = null,
): MessageFixture {
  return { id, content, createdAt, role, status: 'completed', decision: null, authorName };
}

function ticket(
  id: string,
  title: string,
  category: TicketFixture['category'],
  priority: TicketFixture['priority'],
  status: TicketFixture['status'],
  overdue: boolean,
): TicketFixture {
  return {
    id,
    number: null,
    ownerId: 'owned-employee',
    title,
    description: `Descrição de ${title}`,
    type: 'INC',
    category,
    priority,
    impact: 'self',
    status,
    transferRequested: false,
    createdAt: '2026-11-04T11:00:00.000Z',
    resolvedAt: status === 'resolved' ? '2026-11-04T11:30:00.000Z' : null,
    slaStartedAt: '2026-11-04T11:00:00.000Z',
    deadline: '2026-11-04T15:00:00.000Z',
    overdue,
  };
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

async function prepareQueue(
  page: Page,
  build: (analystId: string) => ReturnType<typeof conversation>[],
): Promise<{ items: ReturnType<typeof conversation>[]; failQueue: (value: boolean) => void }> {
  let items: ReturnType<typeof conversation>[] = [];
  let queueFails = false;
  await page.route('**/api/support/conversations?filter=waiting', (route) =>
    route.fulfill(queueFails ? { status: 500 } : { json: items }),
  );
  await page.route('**/api/support/conversations?filter=all', (route) =>
    route.fulfill({ json: items }),
  );
  const analystId = await loginAsAnalyst(page);
  items = build(analystId);
  await showQueue(page, items);
  return {
    items,
    failQueue: (value) => {
      queueFails = value;
    },
  };
}

function detailRoute(page: Page, items: ReturnType<typeof conversation>[]) {
  return page.route('**/api/support/conversations/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    return route.fulfill({ json: detail(items.find((item) => item.id === id)!) });
  });
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
  const queueBox = await page.getByRole('region', { name: 'Conversas' }).boundingBox();
  const errorBox = await page
    .locator('[role="alert"]')
    .filter({ hasText: 'Não foi possível carregar a conversa.' })
    .boundingBox();
  expect(queueBox!.x + queueBox!.width).toBeLessThanOrEqual(errorBox!.x + 1);

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

test('B11 B15: failed claim keeps the detail and reports an error', async ({ page }) => {
  const { items } = await prepareQueue(page, () => [
    conversation('waiting', 'waiting_for_analyst', null),
  ]);
  await detailRoute(page, items);
  await page.route('**/api/support/conversations/waiting/claim', (route) =>
    route.fulfill({ status: 409 }),
  );

  const region = page.getByRole('region', { name: 'Atendimento' });
  await page.locator('[data-conversation-id="waiting"]').click();
  await page.getByRole('button', { name: 'Assumir atendimento' }).click();

  await expect(region).toContainText('Pessoa waiting');
  await expect(region.getByRole('alert')).toHaveText('Não foi possível concluir a ação.');
  await expect(region.getByRole('button', { name: 'Assumir atendimento' })).toBeVisible();
  await expect(page.getByText('Atendimento encerrado.', { exact: true })).toHaveCount(0);
});

test('B11 B15: a failed reply keeps the exact draft and sends one request on double click', async ({
  page,
}) => {
  const { items } = await prepareQueue(page, (analystId) => [
    conversation('owned', 'with_analyst', analystId),
  ]);
  await detailRoute(page, items);
  const response = deferred();
  let posts = 0;
  await page.route('**/api/support/conversations/owned/reply', async (route) => {
    posts += 1;
    await response.promise;
    await route.fulfill({ status: 403 });
  });

  const region = page.getByRole('region', { name: 'Atendimento' });
  const draft = '  Texto exato que não pode ser perdido  ';
  await page.locator('[data-conversation-id="owned"]').click();
  await page.getByLabel('Resposta').fill(draft);
  await page.getByRole('button', { name: 'Enviar resposta' }).evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect.poll(() => posts).toBe(1);
  response.resolve();

  await expect(region.getByRole('alert')).toHaveText('Não foi possível concluir a ação.');
  await expect(page.getByLabel('Resposta')).toHaveValue(draft);
  await expect(
    page.getByText('Resposta enviada. Não foi possível atualizar a conversa.'),
  ).toHaveCount(0);
  expect(posts).toBe(1);
});

test('B11 B15: failed return and close keep the owned detail without success notices', async ({
  page,
}) => {
  const { items } = await prepareQueue(page, (analystId) => [
    conversation('owned', 'with_analyst', analystId),
  ]);
  await detailRoute(page, items);
  await page.route('**/api/support/conversations/owned/return', (route) =>
    route.fulfill({ status: 403 }),
  );
  await page.route('**/api/support/conversations/owned/close', (route) =>
    route.fulfill({ status: 409 }),
  );

  const region = page.getByRole('region', { name: 'Atendimento' });
  await page.locator('[data-conversation-id="owned"]').click();
  await page.getByLabel('Resposta').fill('Rascunho preservado');

  await page.getByRole('button', { name: 'Devolver ao agente' }).click();
  await expect(region.getByRole('alert')).toHaveText('Não foi possível concluir a ação.');
  await expect(region).toContainText('Pessoa owned');
  await expect(page.getByLabel('Resposta')).toHaveValue('Rascunho preservado');
  await expect(page.getByText('Atendimento devolvido ao agente.', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Encerrar atendimento' }).click();
  await expect(region.getByRole('alert')).toHaveText('Não foi possível concluir a ação.');
  await expect(region).toContainText('Pessoa owned');
  await expect(page.getByLabel('Resposta')).toHaveValue('Rascunho preservado');
  await expect(page.getByText('Atendimento encerrado.', { exact: true })).toHaveCount(0);
});

test('B11 B15: reply success followed by failed refresh clears the draft and retries only the GET', async ({
  page,
}) => {
  const { items } = await prepareQueue(page, (analystId) => [
    conversation('owned', 'with_analyst', analystId),
  ]);
  let refreshFails = false;
  await page.route('**/api/support/conversations/owned', (route) =>
    route.fulfill(
      refreshFails ? { status: 500 } : { json: detail(items.find((item) => item.id === 'owned')!) },
    ),
  );
  const response = deferred();
  let posts = 0;
  await page.route('**/api/support/conversations/owned/reply', async (route) => {
    posts += 1;
    await response.promise;
    refreshFails = true;
    await route.fulfill({ status: 200, json: { ok: true } });
  });

  const region = page.getByRole('region', { name: 'Atendimento' });
  await page.locator('[data-conversation-id="owned"]').click();
  await page.getByLabel('Resposta').fill('Resposta enviada');
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(page.getByLabel('Resposta')).toHaveValue('Resposta enviada');
  response.resolve();

  await expect(
    page.getByText('Resposta enviada. Não foi possível atualizar a conversa.'),
  ).toBeVisible();
  await expect(page.getByText('Não foi possível carregar a conversa.')).toBeVisible();
  await expect(page.getByLabel('Resposta')).toHaveCount(0);

  refreshFails = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(region).toContainText('Pessoa owned');
  expect(posts).toBe(1);
});

test('B11: invalid replies are rejected before sending', async ({ page }) => {
  const { items } = await prepareQueue(page, (analystId) => [
    conversation('owned', 'with_analyst', analystId),
  ]);
  await detailRoute(page, items);
  let posts = 0;
  await page.route('**/api/support/conversations/owned/reply', (route) => {
    posts += 1;
    return route.fulfill({ status: 200, json: { ok: true } });
  });

  const region = page.getByRole('region', { name: 'Atendimento' });
  await page.locator('[data-conversation-id="owned"]').click();

  await page.getByLabel('Resposta').fill('   ');
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(region.getByRole('alert')).toHaveText('Informe uma resposta válida.');
  expect(posts).toBe(0);

  await page.getByLabel('Resposta').fill('a'.repeat(4001));
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(region.getByRole('alert')).toHaveText('Informe uma resposta válida.');
  expect(posts).toBe(0);
});

test('B11 B15: committed return and close succeed even when the queue refresh fails', async ({
  page,
}) => {
  const { items, failQueue } = await prepareQueue(page, (analystId) => [
    conversation('a', 'with_analyst', analystId),
    conversation('b', 'with_analyst', analystId),
  ]);
  await detailRoute(page, items);
  let returns = 0;
  let closes = 0;
  await page.route('**/api/support/conversations/a/return', (route) => {
    returns += 1;
    return route.fulfill({ status: 200, json: { ok: true } });
  });
  await page.route('**/api/support/conversations/b/close', (route) => {
    closes += 1;
    return route.fulfill({ status: 200, json: { ok: true } });
  });

  const region = page.getByRole('region', { name: 'Atendimento' });
  await page.locator('[data-conversation-id="a"]').click();
  await page.getByLabel('Resposta').fill('Rascunho A');
  await page.getByRole('button', { name: 'Devolver ao agente' }).click();
  await expect(page.getByText('Atendimento devolvido ao agente.', { exact: true })).toBeVisible();
  await expect(region).toHaveCount(0);
  expect(returns).toBe(1);

  await page.locator('[data-conversation-id="b"]').click();
  await page.getByLabel('Resposta').fill('Rascunho B');
  failQueue(true);
  await page.getByRole('button', { name: 'Encerrar atendimento' }).click();
  await expect(page.getByText('Atendimento encerrado.', { exact: true })).toBeVisible();
  await expect(page.getByText('Não foi possível carregar as conversas.')).toBeVisible();
  await expect(page.getByText('Não foi possível concluir a ação.')).toHaveCount(0);
  await expect(region).toHaveCount(0);
  expect(closes).toBe(1);
});

test('B11 V05: presents role-distinct messages, handoff context, and authorized tickets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1567, height: 900 });
  const { items } = await prepareQueue(page, (analystId) => [
    conversation('owned', 'with_analyst', analystId, {
      reason: 'critical_incident',
      summary: 'Resumo da transferência com <detalhes> & contexto.',
      requestedAt: '2026-11-04T12:00:00.000Z',
    }),
  ]);
  const item = items[0]!;
  item.employee.name = 'Ana & Cia <TI>';
  await page.route('**/api/support/conversations/owned', (route) =>
    route.fulfill({
      json: detail(
        item,
        [
          message(
            'm1',
            'employee',
            'Pergunta <b>importante</b> & detalhes',
            '2026-11-04T12:01:00.000Z',
          ),
          message('m2', 'agent', 'Resposta do agente', '2026-11-04T12:02:00.000Z'),
          message(
            'm3',
            'analyst',
            'Resposta do analista',
            '2026-11-04T12:03:00.000Z',
            'Rafael Lima',
          ),
          message('m4', 'analyst', 'Resposta sem autor', '2026-11-04T12:04:00.000Z'),
        ],
        [
          ticket('t1', 'Notebook lento', 'network_vpn', 'high', 'open', true),
          ticket('t2', 'Acesso à pasta', 'access', 'low', 'resolved', false),
        ],
      ),
    }),
  );

  const region = page.getByRole('region', { name: 'Atendimento' });
  await page.locator('[data-conversation-id="owned"]').click();
  await page.screenshot({ path: 'outputs/analyst-console-v05-1567x900.png', fullPage: true });

  await expect(region.getByRole('heading', { name: 'Resumo da transferência' })).toBeVisible();
  await expect(region).toContainText('Motivo: Incidente crítico');
  await expect(region).toContainText('Resumo da transferência com <detalhes> & contexto.');
  await expect(region.locator('.support-handoff time')).toHaveAttribute(
    'dateTime',
    '2026-11-04T12:00:00.000Z',
  );

  const messages = region.locator('.support-message');
  await expect(messages).toHaveCount(4);
  await expect(messages.nth(0)).toContainText('Ana & Cia <TI>');
  await expect(messages.nth(1)).toContainText('Nexo Assist');
  await expect(messages.nth(2)).toContainText('Rafael Lima');
  await expect(messages.nth(3)).toContainText('Suporte');
  await expect(messages.nth(0)).toContainText('Pergunta <b>importante</b> & detalhes');
  await expect(region.locator('.support-messages img, .support-messages b')).toHaveCount(0);

  const times = messages.locator('time');
  await expect(times).toHaveCount(4);
  for (const [index, value] of [
    '2026-11-04T12:01:00.000Z',
    '2026-11-04T12:02:00.000Z',
    '2026-11-04T12:03:00.000Z',
    '2026-11-04T12:04:00.000Z',
  ].entries()) {
    await expect(times.nth(index)).toHaveAttribute('dateTime', value);
  }

  const ticketPanel = region.getByRole('region', { name: 'Chamados de Ana & Cia <TI>' });
  await expect(ticketPanel).toContainText('Notebook lento');
  await expect(ticketPanel).toContainText('Rede e VPN · prioridade Alta');
  await expect(ticketPanel).toContainText('Aberto');
  await expect(ticketPanel).toContainText('Atrasado');
  await expect(ticketPanel).toContainText('Acesso · prioridade Baixa');
  await expect(ticketPanel).toContainText('Resolvido');
  await expect(ticketPanel.locator('time').first()).toHaveAttribute(
    'dateTime',
    '2026-11-04T15:00:00.000Z',
  );
  await expect(ticketPanel).not.toContainText('Desta conversa');
  await expect(ticketPanel).toContainText('Outros chamados');
  await expect(region.locator('.support-handoff-toggle')).toHaveCount(0);
});

test('B11 V05: expands and collapses a long handoff summary', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const longSummary = 'Contexto detalhado da transferência para o analista. '
    .repeat(36)
    .slice(0, 1900);
  const { items } = await prepareQueue(page, (analystId) => [
    conversation('owned', 'with_analyst', analystId, {
      reason: 'critical_incident',
      summary: longSummary,
      requestedAt: '2026-11-04T12:00:00.000Z',
    }),
  ]);
  await detailRoute(page, items);

  const region = page.getByRole('region', { name: 'Atendimento' });
  await page.locator('[data-conversation-id="owned"]').click();

  const card = region.locator('.support-handoff');
  const summary = card.locator('.support-handoff-summary');
  const more = card.getByRole('button', { name: 'Ver mais' });
  await expect(more).toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toHaveAttribute('data-expanded', 'false');
  const collapsed = await summary.boundingBox();
  expect(collapsed?.height ?? 0).toBeLessThanOrEqual(201);

  await more.focus();
  await page.keyboard.press('Enter');
  const less = card.getByRole('button', { name: 'Ver menos' });
  await expect(less).toHaveAttribute('aria-expanded', 'true');
  await expect(summary).toHaveAttribute('data-expanded', 'true');
  const expanded = await summary.boundingBox();
  expect(expanded?.height ?? 0).toBeGreaterThan((collapsed?.height ?? 0) + 100);

  const cardBox = await card.boundingBox();
  const messageBox = await region.locator('.support-messages').boundingBox();
  expect((cardBox?.y ?? 0) + (cardBox?.height ?? 0)).toBeLessThanOrEqual((messageBox?.y ?? 0) + 1);
  expect(messageBox?.height ?? 0).toBeGreaterThan(0);

  await less.click();
  const moreAgain = card.getByRole('button', { name: 'Ver mais' });
  await expect(moreAgain).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toHaveAttribute('data-expanded', 'false');
  const recollapsed = await summary.boundingBox();
  expect(recollapsed?.height ?? 0).toBeLessThanOrEqual(201);
  await expect(card.locator('time')).toBeVisible();
});

test('B11: empty message and ticket lists stay honest', async ({ page }) => {
  const { items } = await prepareQueue(page, (analystId) => [
    conversation('owned', 'with_analyst', analystId),
  ]);
  await detailRoute(page, items);
  const region = page.getByRole('region', { name: 'Atendimento' });
  await page.locator('[data-conversation-id="owned"]').click();

  await expect(region.getByText('Nenhuma mensagem.')).toBeVisible();
  await expect(region.getByText('Nenhum chamado.')).toBeVisible();
  await expect(region.getByText('Atrasado')).toHaveCount(0);
});

test('B11 V05: read-only states never expose an enabled composer', async ({ page }) => {
  const { items } = await prepareQueue(page, () => [
    conversation('waiting', 'waiting_for_analyst', null),
    conversation('another', 'with_analyst', 'other-analyst'),
    conversation('agent', 'agent', null),
    conversation('closed', 'closed', null),
  ]);
  await detailRoute(page, items);
  const region = page.getByRole('region', { name: 'Atendimento' });

  for (const [id, explanation] of [
    ['waiting', 'Assuma o atendimento para responder.'],
    ['another', 'Somente o analista responsável pode responder.'],
    ['agent', 'O atendimento está com o agente.'],
    ['closed', 'Atendimento encerrado.'],
  ] as const) {
    await page.locator(`[data-conversation-id="${id}"]`).click();
    await expect(region.getByText(explanation)).toBeVisible();
    await expect(region.getByLabel('Resposta')).toHaveCount(0);
    await expect(region.getByRole('button', { name: 'Enviar resposta' })).toHaveCount(0);
  }
});

test('B11 V05: keyboard reaches selection, composer, and send action', async ({ page }) => {
  const { items } = await prepareQueue(page, (analystId) => [
    conversation('owned', 'with_analyst', analystId),
  ]);
  await detailRoute(page, items);
  let posts = 0;
  await page.route('**/api/support/conversations/owned/reply', (route) => {
    posts += 1;
    return route.fulfill({ status: 200, json: { ok: true } });
  });

  const region = page.getByRole('region', { name: 'Atendimento' });
  await page.locator('[data-conversation-id="owned"]').focus();
  await page.keyboard.press('Enter');
  await expect(region).toContainText('Pessoa owned');

  await page.getByLabel('Resposta').focus();
  await page.keyboard.type('Resposta via teclado');
  await expect(page.getByLabel('Resposta')).toBeFocused();
  await page.getByRole('button', { name: 'Enviar resposta' }).focus();
  await expect(page.getByRole('button', { name: 'Enviar resposta' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => posts).toBe(1);
  await expect(page.getByLabel('Resposta')).toHaveValue('');
});

for (const viewport of [
  { width: 1567, height: 900 },
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`B11 V05: long content stays readable without overflow at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const { items } = await prepareQueue(page, (analystId) => [
      conversation('owned', 'with_analyst', analystId),
    ]);
    const item = items[0]!;
    await page.route('**/api/support/conversations/owned', (route) =>
      route.fulfill({
        json: detail(
          item,
          [
            message('long', 'employee', 'M'.repeat(400), '2026-11-04T12:01:00.000Z'),
            message(
              'special',
              'analyst',
              'Ação & suporte <ok> ção',
              '2026-11-04T12:02:00.000Z',
              'Ana',
            ),
          ],
          [
            ticket(
              'long-ticket',
              `Chamado-${'x'.repeat(180)}`,
              'hardware',
              'critical',
              'open',
              true,
            ),
          ],
        ),
      }),
    );
    const region = page.getByRole('region', { name: 'Atendimento' });
    await page.locator('[data-conversation-id="owned"]').click();
    await expect(region).toContainText('Ação & suporte <ok> ção');

    const layout = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      };
      const detailElement = document.querySelector<HTMLElement>('.support-detail')!;
      const ticketElement = document.querySelector<HTMLElement>('.support-ticket-context')!;
      return {
        documentWidth: document.documentElement.scrollWidth,
        windowWidth: window.innerWidth,
        detailOverflow: detailElement.scrollWidth - detailElement.clientWidth,
        ticketOverflow: ticketElement.scrollWidth - ticketElement.clientWidth,
        queue: box('.support-list'),
        detail: box('.support-detail'),
        messages: box('.support-messages'),
        ticket: box('.support-ticket-context'),
        form: box('.support-detail form'),
      };
    });

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.windowWidth);
    expect(layout.detailOverflow).toBeLessThanOrEqual(0);
    expect(layout.ticketOverflow).toBeLessThanOrEqual(0);

    if (viewport.width >= 1200) {
      expect(layout.queue.right).toBeLessThanOrEqual(layout.detail.left + 1);
      expect(layout.messages.right).toBeLessThanOrEqual(layout.ticket.left + 1);
    } else {
      expect(layout.queue.bottom).toBeLessThanOrEqual(layout.detail.top + 1);
      expect(layout.messages.bottom).toBeLessThanOrEqual(layout.ticket.top + 1);
      expect(layout.ticket.bottom).toBeLessThanOrEqual(layout.form.top + 1);
    }
  });
}

test('B11: a linked request offers approve or conclude and shows its number', async ({ page }) => {
  let items: ReturnType<typeof conversation>[] = [];
  await page.route('**/api/support/conversations?filter=waiting', (route) =>
    route.fulfill({ json: items }),
  );
  await page.route('**/api/support/conversations?filter=all', (route) =>
    route.fulfill({ json: items }),
  );
  const requestTicket = {
    ...ticket('req-ticket', 'Segundo monitor', 'hardware', 'high', 'open', false),
    type: 'REQ' as const,
    number: 'REQ-10442',
  };
  const otherTicket = {
    ...ticket('other-ticket', 'Senha bloqueada', 'access', 'medium', 'resolved', false),
    number: 'INC-20150',
  };
  let item = conversation('req', 'with_analyst', null);
  await page.route('**/api/support/conversations/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)!;
    return route.fulfill({
      json:
        id === 'req'
          ? detail(item, [], [otherTicket, requestTicket])
          : detail(items.find((row) => row.id === id)!),
    });
  });
  const closes: string[] = [];
  await page.route('**/api/support/conversations/*/close', (route) => {
    closes.push(route.request().postData() ?? '');
    return route.fulfill({ json: item });
  });

  const analystId = await loginAsAnalyst(page);
  item = { ...conversation('req', 'with_analyst', analystId), contextTicketId: 'req-ticket' };
  items = [item];
  await showQueue(page, items);
  await page.locator('[data-conversation-id="req"]').click();
  const region = page.getByRole('region', { name: 'Atendimento' });
  const current = region.getByRole('region', { name: 'Desta conversa' });
  await expect(current).toContainText('REQ-10442');
  await expect(region.getByRole('region', { name: 'Outros chamados' })).toContainText('INC-20150');
  await expect(region.getByRole('button', { name: 'Aprovar solicitação' })).toBeVisible();
  await expect(region.getByRole('button', { name: 'Concluir atendimento' })).toBeVisible();
  await page.screenshot({ path: 'outputs/analyst-close-choice-1440x900.png', fullPage: true });
  await region.getByRole('button', { name: 'Aprovar solicitação' }).click();
  await expect.poll(() => closes.at(-1)).toContain('"outcome":"approved"');
});
