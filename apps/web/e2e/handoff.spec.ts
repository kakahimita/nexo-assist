import { expect, test } from '@playwright/test';

async function start(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Nova conversa' }).click();
}

test('B09 B10 B13: employee can request human support and continue sending messages', async ({
  page,
}) => {
  await start(page);
  const chat = page.getByRole('region', { name: 'Conversa' });

  await chat.getByRole('button', { name: 'Falar com analista' }).click();
  await expect(chat.getByRole('status')).toContainText('Aguardando atendimento humano');
  await expect(chat.getByRole('button', { name: 'Falar com analista' })).toHaveCount(0);

  await chat.getByLabel('Mensagem').fill('Ainda preciso de ajuda');
  await chat.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(chat.getByText('Ainda preciso de ajuda')).toBeVisible();
  await expect(chat.getByRole('status')).toContainText('Aguardando atendimento humano');
  await expect(chat.getByText('Nexo Assist')).toHaveCount(0);
});
