import { expect, test } from '@playwright/test';

test('B04: employee reviews and confirms a conversation draft', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  const chat = page.getByRole('region', { name: 'Conversa' });
  await chat.getByLabel('Mensagem').fill('Abrir chamado: Meu notebook não liga no setor 234');
  await chat.getByRole('button', { name: 'Enviar mensagem' }).click();
  await chat.getByRole('button', { name: 'Somente eu' }).click();
  await chat.getByRole('button', { name: 'Consigo trabalhar com alternativa' }).click();
  await chat.getByRole('button', { name: 'Sem compromisso em risco hoje' }).click();
  const draft = chat.getByRole('article', { name: 'Rascunho do chamado' });
  await expect(draft.getByText('Meu notebook não liga no setor 234').first()).toBeVisible();
  await expect(draft.getByText(/Prioridade: Média/)).toBeVisible();
  await expect(chat.getByText('Não foi possível recuperar os rascunhos pendentes.')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'outputs/conversational-draft-desktop.png', fullPage: true });
  await draft.getByRole('button', { name: 'Confirmar rascunho' }).click();
  await expect(draft.getByText('Chamado confirmado.')).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Chamados' })
      .getByRole('button', { name: 'Meu notebook não liga no setor 234' }),
  ).toBeVisible();
});

async function createDraft(page: import('@playwright/test').Page, title: string) {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  const chat = page.getByRole('region', { name: 'Conversa' });
  await chat.getByLabel('Mensagem').fill(`Abrir chamado: ${title}`);
  await chat.getByRole('button', { name: 'Enviar mensagem' }).click();
  await chat.getByRole('button', { name: 'Somente eu' }).click();
  await chat.getByRole('button', { name: 'Consigo trabalhar com alternativa' }).click();
  const response = page.waitForResponse(
    (item) =>
      /\/api\/ticket-drafts\/[^/]+$/.test(new URL(item.url()).pathname) &&
      item.request().method() === 'GET' &&
      item.ok(),
  );
  await chat.getByRole('button', { name: 'Sem compromisso em risco hoje' }).click();
  const data = await (await response).json();
  const draft = chat.getByRole('article', { name: 'Rascunho do chamado' });
  await expect(draft.getByRole('button', { name: 'Confirmar rascunho' })).toBeVisible();
  return { draft, data };
}

test('B04: editing then cancelling a draft does not create a ticket', async ({ page }) => {
  const { draft } = await createDraft(page, 'Meu projetor não liga no prédio 766');
  await draft.getByRole('button', { name: 'Editar rascunho' }).click();
  await draft.getByLabel('Título').fill('Projetor do prédio 766 com falha');
  await draft.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(draft.getByText('Projetor do prédio 766 com falha')).toBeVisible();
  await draft.getByRole('button', { name: 'Cancelar rascunho' }).click();
  await expect(draft.getByText('Rascunho cancelado.')).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Chamados' })
      .getByRole('button', { name: 'Projetor do prédio 766 com falha' }),
  ).toHaveCount(0);
});

test('B04: stale confirmation reloads the current draft and requires another click', async ({
  page,
}) => {
  const { draft, data } = await createDraft(page, 'Meu projetor não liga no prédio 987');
  const edited = await page.request.post(`/api/ticket-drafts/${data.id}/edit`, {
    headers: { origin: new URL(page.url()).origin },
    data: {
      version: data.version,
      input: { ...data.input, title: 'Projetor atualizado do prédio 987' },
    },
  });
  expect(edited.status()).toBe(201);
  await draft.getByRole('button', { name: 'Confirmar rascunho' }).click();
  await expect(draft.getByRole('alert')).toContainText('O rascunho foi atualizado');
  await expect(draft.getByText('Projetor atualizado do prédio 987')).toBeVisible();
  await draft.getByRole('button', { name: 'Confirmar rascunho' }).click();
  await expect(draft.getByText('Chamado confirmado.')).toBeVisible();
});

test('B14: draft confirmation remains available after the thirtieth message', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const creation = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/conversations') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  const id = String((await (await creation).json()).id);
  const origin = new URL(page.url()).origin;
  for (let i = 0; i < 26; i++)
    expect(
      (
        await page.request.post(`/api/conversations/${id}/messages`, {
          headers: { origin },
          data: { content: `Mensagem ${i}` },
        })
      ).status(),
    ).toBe(201);
  await page.reload();
  const list = (await (await page.request.get('/api/conversations')).json()) as Array<{
    id: string;
  }>;
  const index = list.findIndex((item) => item.id === id);
  expect(index).toBeGreaterThanOrEqual(0);
  await page
    .getByRole('navigation', { name: 'Conversas' })
    .getByRole('button', { name: `Conversa ${index + 1}`, exact: true })
    .click();
  const chat = page.getByRole('region', { name: 'Conversa' });
  await expect(chat.getByText('Mensagens: 26 de 30')).toBeVisible();
  await chat.getByLabel('Mensagem').fill('Abrir chamado: Minha impressora travou na sala 419');
  await chat.getByRole('button', { name: 'Enviar mensagem' }).click();
  await chat.getByRole('button', { name: 'Somente eu' }).click();
  await chat.getByRole('button', { name: 'Consigo trabalhar com alternativa' }).click();
  await chat.getByRole('button', { name: 'Sem compromisso em risco hoje' }).click();
  await expect(chat.getByText('Mensagens: 30 de 30')).toBeVisible();
  await expect(chat.getByLabel('Mensagem')).toBeDisabled();
  const draft = chat.getByRole('article', { name: 'Rascunho do chamado' });
  await draft.getByRole('button', { name: 'Confirmar rascunho' }).click();
  await expect(draft.getByText('Chamado confirmado.')).toBeVisible();
  await expect(chat.getByText('Mensagens: 30 de 30')).toBeVisible();
});
