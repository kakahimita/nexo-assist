import { expect, test } from '@playwright/test';

test('B05: employee reviews a possible duplicate before creating a different ticket', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('bruno.lima@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const tickets = page.getByRole('region', { name: 'Chamados' });
  await tickets.getByRole('button', { name: 'Novo chamado' }).click();
  await tickets.getByLabel('Título').fill('Acesso remoto à VPN');
  await tickets.getByLabel('Descrição').fill('Preciso de acesso à VPN para outro equipamento');
  await tickets.getByLabel('Tipo').selectOption('REQ');
  await tickets.getByLabel('Categoria').selectOption('network_vpn');
  await tickets.getByLabel('Pessoas afetadas').selectOption('self');
  await tickets.getByLabel('Situação do trabalho').selectOption('request');
  await tickets.getByLabel('Urgência').selectOption('normal');
  await tickets.getByRole('button', { name: 'Revisar chamado' }).click();
  const draft = tickets.getByRole('article', { name: 'Rascunho para confirmação' });
  await expect(draft.getByRole('button', { name: 'Confirmar alteração' })).toBeDisabled();
  await draft.getByLabel('É outro problema').check();
  await draft.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(tickets.getByText('Alteração confirmada.', { exact: true })).toBeVisible();
});
