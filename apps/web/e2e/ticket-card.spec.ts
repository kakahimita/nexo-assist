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

const ticket = {
  id: 'fixture-ana-open',
  title: 'Notebook lento',
  status: 'open',
  priority: 'medium',
  category: 'hardware',
  createdAt: '2026-11-04T01:00:00.000Z',
  deadline: '2026-11-07T12:00:00.000Z',
  lastUpdate: '2026-10-21T12:00:00.000Z',
  overdue: false,
};

const decision = (tickets: unknown[], action: 'answer' | 'handoff'): Record<string, unknown> => ({
  intent: 'Consulta de chamado',
  action,
  appliedRule: 'Somente chamados do funcionário',
  confidence: 1,
  justification: 'Chamado identificado.',
  missingFacts: [],
  quickReplies: [],
  actions: [
    {
      id: 'consult-1',
      tool: 'consult-tickets',
      status: 'succeeded',
      label: 'Consulta de chamados',
      summary: 'Consulta concluída.',
    },
  ],
  evidence: [],
  tickets,
  outcome: 'completed',
  errorCode: null,
  source: 'deterministic',
  draftId: null,
});

function agentMessage(content: string, value: Record<string, unknown>) {
  return {
    id: 'agent-ticket',
    content,
    createdAt: '2026-11-04T12:00:00.000Z',
    role: 'agent',
    status: 'completed',
    authorName: null,
    decision: value,
  };
}

async function mockStream(
  page: import('@playwright/test').Page,
  events: Array<Record<string, unknown>>,
) {
  await page.route('**/api/conversations/*/messages/stream', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'text/event-stream',
      body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
    }),
  );
}

test('B03: shows the detail card for one consulted ticket inside the chat', async ({ page }) => {
  await start(page);
  const user = {
    id: 'user-test',
    content: 'Qual o status do Notebook lento?',
    createdAt: '2026-11-04T12:00:00.000Z',
    role: 'employee',
    status: 'completed',
    decision: null,
    authorName: null,
  };
  await mockStream(page, [
    { type: 'user-message', message: user },
    {
      type: 'done',
      message: agentMessage('O chamado está em andamento.', decision([ticket], 'answer')),
    },
  ]);
  await send(page, 'Qual o status do Notebook lento?');
  const chat = page.getByRole('region', { name: 'Conversa' });
  const card = chat.getByRole('article', { name: 'Chamado Notebook lento' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Aberto');
  await expect(card).toContainText('Categoria: Hardware');
  await expect(card).toContainText('Criado em: 03/11/2026');
  await expect(card).toContainText('Prioridade: Média');
  await expect(card).toContainText('Prazo: 07/11/2026');
  await expect(card).toContainText('Última atualização: há');
  await expect(card.getByText('Prazo vencido')).toHaveCount(0);
});

test('B09 B10: an overdue handoff shows the card, the waiting state, and no ticket choices', async ({
  page,
}) => {
  await start(page);
  const user = {
    id: 'user-test',
    content: 'Qual o status do Notebook lento?',
    createdAt: '2026-11-04T12:00:00.000Z',
    role: 'employee',
    status: 'completed',
    decision: null,
    authorName: null,
  };
  await mockStream(page, [
    { type: 'user-message', message: user },
    {
      type: 'done',
      message: agentMessage(
        'Notebook lento está com o prazo vencido. Transferi a conversa para um analista.',
        decision([{ ...ticket, overdue: true }], 'handoff'),
      ),
    },
    { type: 'handoff-waiting' },
  ]);
  await send(page, 'Qual o status do Notebook lento?');
  const chat = page.getByRole('region', { name: 'Conversa' });
  await expect(chat.getByRole('status')).toContainText('Aguardando atendimento humano');
  await expect(
    chat.getByRole('article', { name: 'Chamado Notebook lento' }).getByText('Prazo vencido'),
  ).toBeVisible();
  await expect(chat.getByRole('button', { name: /Notebook lento/ })).toHaveCount(0);
});

test('B03 B13: a stored ticket without metadata renders an honest fallback', async ({ page }) => {
  await start(page);
  const legacyTicket = {
    id: 'fixture-legacy-open',
    title: 'Notebook antigo',
    status: 'open',
    priority: 'low',
    deadline: '2026-11-07T12:00:00.000Z',
    lastUpdate: '2026-10-21T12:00:00.000Z',
    overdue: false,
  };
  await mockStream(page, [
    {
      type: 'user-message',
      message: {
        id: 'user-legacy',
        content: 'Qual o status do Notebook antigo?',
        createdAt: '2026-11-04T12:00:00.000Z',
        role: 'employee',
        status: 'completed',
        decision: null,
        authorName: null,
      },
    },
    {
      type: 'done',
      message: agentMessage('O chamado está aberto.', decision([legacyTicket], 'answer')),
    },
  ]);
  await send(page, 'Qual o status do Notebook antigo?');
  const chat = page.getByRole('region', { name: 'Conversa' });
  const card = chat.getByRole('article', { name: 'Chamado Notebook antigo' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Categoria: —');
  await expect(card).toContainText('Criado em: —');
  await expect(chat.getByRole('alert')).toHaveCount(0);
});

test('V03: a long ticket keeps its status and overdue text without horizontal overflow', async ({
  page,
}) => {
  await start(page);
  const longTicket = {
    ...ticket,
    title:
      'Notebook corporativo com lentidão após a atualização do Windows e do antivírus corporativo',
    overdue: true,
    deadline: '2026-11-02T12:00:00.000Z',
  };
  await mockStream(page, [
    {
      type: 'user-message',
      message: {
        id: 'user-long',
        content: 'Qual o status do meu notebook?',
        createdAt: '2026-11-04T12:00:00.000Z',
        role: 'employee',
        status: 'completed',
        decision: null,
        authorName: null,
      },
    },
    {
      type: 'done',
      message: agentMessage(
        'O chamado está com o prazo vencido.',
        decision([longTicket], 'answer'),
      ),
    },
  ]);
  await send(page, 'Qual o status do meu notebook?');
  const chat = page.getByRole('region', { name: 'Conversa' });
  const card = chat.getByRole('article', { name: `Chamado ${longTicket.title}` });
  const overflow = () =>
    page.evaluate(() => {
      const target = document.querySelector('.consultation-ticket-card');
      return {
        document: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        card: target === null || target.scrollWidth > target.clientWidth,
      };
    });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(card).toBeVisible();
    await expect(card.getByText('Aberto', { exact: true })).toBeVisible();
    await expect(card.getByText('Prazo vencido')).toBeVisible();
    expect(await overflow()).toEqual({ document: false, card: false });
    await page.screenshot({
      path: `outputs/ticket-card-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
    await card.screenshot({
      path: `outputs/ticket-card-${viewport.width}x${viewport.height}-card.png`,
    });
  }
});
