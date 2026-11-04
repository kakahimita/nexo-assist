import { expect, test } from '@playwright/test';

test('V06: profile displays the signed-in employee and preserves the conversation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('qualquer');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  await page.getByLabel('Mensagem').fill('Texto ainda não enviado');
  await page.getByRole('button', { name: 'Meu perfil' }).click();
  await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
  await expect(page.getByText('ana.souza@nexo.com.br')).toBeVisible();
  await expect(page.getByText('Ana Souza', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /redefinir senha/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Atendimento' }).click();
  await expect(page.getByLabel('Mensagem')).toHaveValue('Texto ainda não enviado');
});
