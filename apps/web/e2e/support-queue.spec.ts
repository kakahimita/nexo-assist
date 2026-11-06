import { expect, test } from '@playwright/test';

async function loginAsAnalyst(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('analista@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
  return page.evaluate(async () => (await (await fetch('/api/session')).json()).id as string);
}

test('V04: searches the loaded queue by employee name and message', async ({ page }) => {
  const item = (id: string, name: string, content: string) => ({
    id,
    state: 'waiting_for_analyst',
    stateVersion: 0,
    employee: { id: `${id}-employee`, name },
    handoff: null,
    assignedAnalystId: null,
    closedAt: null,
    lastMessage: { content, createdAt: '2026-11-04T12:03:00.000Z', role: 'employee' },
  });
  await page.route('**/api/support/conversations?filter=*', (route) =>
    route.fulfill({
      json: [item('ana', 'Ana Souza', 'Notebook lento'), item('bruna', 'Bruna Lima', 'Acesso VPN')],
    }),
  );
  await loginAsAnalyst(page);
  const queue = page.getByRole('region', { name: 'Conversas' });
  const search = queue.getByRole('searchbox', { name: 'Pesquisar conversas' });
  await search.fill('vpn');
  await expect(queue.getByRole('button', { name: /Bruna Lima/ })).toBeVisible();
  await expect(queue.getByRole('button', { name: /Ana Souza/ })).toHaveCount(0);
  await search.fill('sem resultado');
  await expect(queue.getByText('Nenhuma conversa encontrada.')).toBeVisible();
});

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
  await page.screenshot({ path: 'outputs/analyst-queue-loading-1440x900.png', fullPage: true });

  release();
  await expect(page.getByText('Nenhuma conversa neste filtro.')).toBeVisible();
  await page.screenshot({ path: 'outputs/analyst-queue-empty-1440x900.png', fullPage: true });
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
  await page.screenshot({ path: 'outputs/analyst-queue-error-1440x900.png', fullPage: true });
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Nenhuma conversa neste filtro.')).toBeVisible();
  await expect(page.getByText('Não foi possível carregar as conversas.')).toHaveCount(0);
  expect(requests).toBe(2);
});

test('B11: ignores an older filter response after the analyst changes filters', async ({
  page,
}) => {
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

test('B11: ignores an obsolete queue failure after the analyst changes filters', async ({
  page,
}) => {
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
    await route.fulfill({ status: 500 });
  });
  await page.route('**/api/support/conversations?filter=owned', async (route) => {
    await route.fulfill({ json: [summary('owned', 'Fila atual')] });
  });

  await loginAsAnalyst(page);
  await page.getByRole('button', { name: 'Minhas' }).click();
  await expect(page.getByText('Fila atual')).toBeVisible();
  releaseWaiting();
  await expect(page.getByText('Não foi possível carregar as conversas.')).toHaveCount(0);
});

test('B11: queue retry preserves the selected detail, reply, and action error', async ({
  page,
}) => {
  const item = {
    id: 'owned',
    state: 'with_analyst' as const,
    stateVersion: 0,
    employee: { id: 'employee', name: 'Conversa preservada' },
    handoff: null,
    assignedAnalystId: 'analyst',
    closedAt: null,
    lastMessage: null,
  };
  let allRequests = 0;
  await page.route('**/api/support/conversations?filter=waiting', async (route) => {
    await route.fulfill({ json: [item] });
  });
  await page.route('**/api/support/conversations?filter=all', async (route) => {
    allRequests += 1;
    await route.fulfill({ status: allRequests === 1 ? 500 : 200, json: [] });
  });
  await page.route('**/api/support/conversations/owned', async (route) => {
    await route.fulfill({ json: { conversation: item, messages: [], tickets: [] } });
  });
  await page.route('**/api/support/conversations/owned/close', async (route) => {
    await route.fulfill({ status: 500 });
  });

  const analystId = await loginAsAnalyst(page);
  item.assignedAnalystId = analystId;
  await page.locator('[data-conversation-id="owned"]').click();
  await page.getByLabel('Resposta').fill('Rascunho que não pode ser perdido');
  await page.getByRole('button', { name: 'Encerrar atendimento' }).click();
  await expect(page.getByText('Não foi possível concluir a ação.')).toBeVisible();

  await page.getByRole('button', { name: 'Todas' }).click();
  await expect(page.getByText('Não foi possível carregar as conversas.')).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Não foi possível carregar as conversas.')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Atendimento' })).toContainText(
    'Conversa preservada',
  );
  await expect(page.getByLabel('Resposta')).toHaveValue('Rascunho que não pode ser perdido');
  await expect(page.getByText('Não foi possível concluir a ação.')).toBeVisible();
});

test('B11 V04: presents supported queue facts, filters, and keyboard selection', async ({
  page,
}) => {
  const summary = (
    id: string,
    name: string,
    state: 'agent' | 'waiting_for_analyst' | 'with_analyst' | 'closed',
    reason:
      | 'employee_request'
      | 'critical_incident'
      | 'overdue_ticket'
      | 'unresolved_uncertainty'
      | null,
    lastMessage: { content: string; createdAt: string } | null,
  ) => ({
    id,
    state,
    stateVersion: 0,
    employee: { id: `${id}-employee`, name },
    handoff: reason
      ? {
          reason,
          summary: 'Context supplied by the service.',
          requestedAt: '2026-11-04T12:00:00.000Z',
        }
      : null,
    assignedAnalystId: state === 'with_analyst' ? 'analyst-1' : null,
    closedAt: state === 'closed' ? '2026-11-04T12:10:00.000Z' : null,
    lastMessage: lastMessage && { ...lastMessage, role: 'employee' as const },
  });
  const items = [
    summary(
      'one',
      'Nome muito longo para confirmar que continua legível na fila',
      'waiting_for_analyst',
      'employee_request',
      {
        content:
          'Mensagem longa que pode ser truncada visualmente sem perder o conteúdo do documento.',
        createdAt: '2026-11-04T12:03:00.000Z',
      },
    ),
    summary('two', 'Bruna', 'agent', 'critical_incident', null),
    summary('three', 'Caio', 'with_analyst', 'overdue_ticket', null),
    summary('four', 'Dani', 'closed', 'unresolved_uncertainty', null),
  ];
  const selectedItem = items[0]!;
  let selected = false;
  const requestedFilters: string[] = [];
  await page.route('**/api/support/conversations?filter=*', async (route) => {
    requestedFilters.push(new URL(route.request().url()).searchParams.get('filter') ?? '');
    await route.fulfill({ json: items });
  });
  await page.route('**/api/support/conversations/one', async (route) => {
    selected = true;
    await route.fulfill({
      json: { conversation: selectedItem, messages: [], tickets: [] },
    });
  });

  await loginAsAnalyst(page);

  const queue = page.getByRole('region', { name: 'Conversas' });
  await expect(queue.getByRole('button', { name: 'Para você' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(queue.getByText('Aguardando atendente')).toBeVisible();
  await expect(queue.getByText('Com o agente')).toBeVisible();
  await expect(queue.getByText('Em atendimento')).toBeVisible();
  await expect(queue.getByText('Encerrada')).toBeVisible();
  await expect(queue.getByText('Transferida')).toBeVisible();
  await expect(queue.getByText('Incidente crítico')).toBeVisible();
  await expect(queue.getByText('Chamado vencido')).toBeVisible();
  await expect(queue.getByText('Sem segurança')).toBeVisible();
  await expect(queue.getByText('Sem mensagens.')).toHaveCount(3);
  await expect(queue.locator('time')).toHaveAttribute('dateTime', '2026-11-04T12:03:00.000Z');
  await expect(queue.locator('time')).toContainText(/04\/11\/2026.*09:03/);
  await expect(
    queue.getByText(
      'Mensagem longa que pode ser truncada visualmente sem perder o conteúdo do documento.',
    ),
  ).toBeAttached();

  await queue.getByRole('button', { name: 'Todas' }).click();
  await expect(queue.getByRole('button', { name: 'Todas' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => requestedFilters).toContain('all');
  await queue.getByRole('button', { name: 'Para você' }).click();
  await expect(queue.getByRole('button', { name: 'Para você' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await queue.getByRole('button', { name: 'Todas' }).focus();
  await page.keyboard.press('Tab');
  await expect(queue.getByRole('button', { name: 'Para você' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(queue.getByRole('button', { name: 'Minhas' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(queue.getByRole('button', { name: 'Minhas' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(queue.getByRole('button', { name: 'Para você' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  const row = queue.locator('[data-conversation-id="one"]');
  await row.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => selected).toBe(true);
  await expect(page.getByRole('region', { name: 'Atendimento' })).toContainText(
    selectedItem.employee.name,
  );
  await page.screenshot({ path: 'outputs/analyst-queue-selected-1440x900.png', fullPage: true });
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`B11 V04: queue does not overflow horizontally at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/api/support/conversations?filter=waiting', async (route) => {
      await route.fulfill({
        json: [
          {
            id: 'long',
            state: 'waiting_for_analyst',
            stateVersion: 0,
            employee: {
              id: 'employee',
              name: 'Nome extraordinariamente longo sem espaços para testar a quebra do cartão',
            },
            handoff: null,
            assignedAnalystId: null,
            closedAt: null,
            lastMessage: {
              role: 'employee',
              createdAt: '2026-11-04T12:03:00.000Z',
              content:
                'Mensagem extremamente longa para verificar que a prévia não aumenta a largura do documento em telas estreitas.',
            },
          },
        ],
      });
    });

    await loginAsAnalyst(page);
    await expect(
      page.getByText('Nome extraordinariamente longo sem espaços para testar a quebra do cartão'),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: `outputs/analyst-queue-populated-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
  });
}
