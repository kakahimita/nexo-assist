import { expect, test } from '@playwright/test';

test('B03 B04 B05 B13 B15: review, edit, retry and restore an employee ticket', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Meus chamados' })
    .click();
  const tickets = page.getByRole('region', { name: 'Chamados' });
  await tickets.getByRole('button', { name: 'Notebook lento' }).click();
  await expect(tickets.getByText(/Prazo/)).toBeVisible();
  await tickets.getByRole('button', { name: 'Novo chamado' }).click();
  await tickets.getByLabel('Título').fill('Falha no monitor');
  await tickets.getByLabel('Descrição').fill('O monitor não liga');
  await tickets.getByLabel('Tipo').selectOption('INC');
  await tickets.getByLabel('Categoria').selectOption('hardware');
  await tickets.getByLabel('Pessoas afetadas').selectOption('self');
  await tickets.getByLabel('Situação do trabalho').selectOption('stopped');
  await tickets.getByLabel('Urgência').selectOption('normal');
  await tickets.getByRole('button', { name: 'Revisar chamado' }).click();
  await expect(tickets.getByText('Prioridade: Alta')).toBeVisible();
  await expect(tickets.getByText('O monitor não liga')).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'outputs/ticket-draft-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: 'outputs/ticket-draft-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await tickets.getByRole('button', { name: 'Editar rascunho' }).click();
  await tickets.getByLabel('Título').fill('Falha no monitor externo');
  await tickets.getByRole('button', { name: 'Revisar chamado' }).click();
  await page.route('**/api/ticket-drafts/*/confirm', (route) => route.fulfill({ status: 503 }));
  await tickets.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(tickets.getByRole('alert')).toContainText('Não foi possível confirmar');
  await page.unroute('**/api/ticket-drafts/*/confirm');
  await page.route('**/api/tickets', (route) => route.fulfill({ status: 503 }));
  await tickets.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(tickets.getByText('Alteração confirmada.', { exact: true })).toBeVisible();
  await expect(tickets.getByRole('alert')).toContainText(
    'Alteração confirmada, mas não foi possível atualizar a lista',
  );
  await page.unroute('**/api/tickets');
  await page.reload();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Meus chamados' })
    .click();
  await expect(tickets.getByRole('button', { name: 'Falha no monitor externo' })).toHaveCount(1);
  await tickets.getByRole('button', { name: 'Falha no monitor externo' }).click();
  await expect(tickets.getByText('O monitor não liga').first()).toBeVisible();
  await tickets.getByRole('button', { name: 'Novo chamado' }).click();
  await tickets.getByLabel('Título').fill('Chamado para cancelar');
  await tickets.getByLabel('Descrição').fill('Sem alteração');
  await tickets.getByLabel('Tipo').selectOption('REQ');
  await tickets.getByLabel('Categoria').selectOption('software');
  await tickets.getByLabel('Pessoas afetadas').selectOption('self');
  await tickets.getByLabel('Situação do trabalho').selectOption('request');
  await tickets.getByLabel('Urgência').selectOption('normal');
  await tickets.getByRole('button', { name: 'Revisar chamado' }).click();
  await tickets.getByRole('button', { name: 'Cancelar rascunho' }).click();
  await expect(tickets.getByRole('button', { name: 'Chamado para cancelar' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.getByLabel('E-mail corporativo').fill('bruno.lima@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Meus chamados' })
    .click();
  await expect(tickets.getByRole('button', { name: 'Falha no monitor externo' })).toHaveCount(0);
});

test('B04 B06: confirm a supplement and reopen a recently resolved ticket', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Meus chamados' })
    .click();
  const tickets = page.getByRole('region', { name: 'Chamados' });
  await tickets.getByRole('button', { name: 'Notebook lento' }).click();
  await tickets.getByRole('button', { name: 'Adicionar informação' }).click();
  await tickets.getByLabel('Informações adicionais').fill('A lentidão começou hoje');
  await tickets.getByRole('button', { name: 'Revisar chamado' }).click();
  await tickets.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(tickets.getByText('A lentidão começou hoje')).toBeVisible();
  await tickets.getByRole('button', { name: 'Senha bloqueada' }).click();
  await tickets.getByRole('button', { name: 'Reabrir chamado' }).click();
  await tickets.getByLabel('Motivo').fill('O bloqueio voltou');
  await tickets.getByRole('button', { name: 'Revisar chamado' }).click();
  await tickets.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(tickets.getByText('O bloqueio voltou')).toBeVisible();
  await expect(tickets.getByText(/Situação: Aberto/)).toBeVisible();
});

test('B04: a stale confirmation reloads the current draft for review', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: 'Meus chamados' })
    .click();
  const tickets = page.getByRole('region', { name: 'Chamados' });
  await tickets.getByRole('button', { name: 'Novo chamado' }).click();
  await tickets.getByLabel('Título').fill('Rascunho antigo');
  await tickets.getByLabel('Descrição').fill('Detalhes do problema');
  await tickets.getByLabel('Tipo').selectOption('INC');
  await tickets.getByLabel('Categoria').selectOption('software');
  await tickets.getByLabel('Pessoas afetadas').selectOption('self');
  await tickets.getByLabel('Situação do trabalho').selectOption('stopped');
  await tickets.getByLabel('Urgência').selectOption('normal');
  await tickets.getByRole('button', { name: 'Revisar chamado' }).click();
  await expect(tickets.getByRole('article', { name: 'Rascunho para confirmação' })).toBeVisible();
  const id = await page.evaluate(() => sessionStorage.getItem('nexo_ticket_draft'));
  expect(id).toBeTruthy();
  const current = await (await page.request.get(`/api/ticket-drafts/${id}`)).json();
  const edit = await page.request.post(`/api/ticket-drafts/${id}/edit`, {
    headers: { Origin: new URL(page.url()).origin },
    data: { version: current.version, input: { ...current.input, title: 'Rascunho atualizado' } },
  });
  expect(edit.status()).toBe(201);
  await tickets.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(tickets.getByRole('alert')).toContainText(
    'O rascunho foi atualizado. Confira os dados antes de confirmar.',
  );
  await expect(tickets.getByText('Rascunho atualizado', { exact: true })).toBeVisible();
  await tickets.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(tickets.getByText('Alteração confirmada.', { exact: true })).toBeVisible();
});
