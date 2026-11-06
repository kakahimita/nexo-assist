import { expect, test } from '@playwright/test';
import { startFreshConversation } from './employee-chat';

test('V06: profile displays the signed-in employee and preserves the conversation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('qualquer');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await startFreshConversation(page);
  await page.getByLabel('Mensagem').fill('Texto ainda não enviado');
  await page.getByRole('button', { name: 'Meu perfil' }).click();
  await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
  const profile = page.getByRole('region', { name: 'Meu perfil' });
  await expect(profile.getByText('ana.souza@nexo.com.br')).toBeVisible();
  await expect(profile.getByText('Ana Souza', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /redefinir senha/i })).toBeDisabled();
  await expect(
    profile.getByText('A redefinição de senha não está disponível nesta demonstração.'),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'outputs/profile-v06-1440x900.png', fullPage: true });
  await page.getByRole('button', { name: 'Atendimento' }).click();
  await expect(page.getByLabel('Mensagem')).toHaveValue('Texto ainda não enviado');
});
