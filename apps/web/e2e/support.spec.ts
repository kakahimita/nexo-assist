import { expect, test } from '@playwright/test';

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
}

test('B11: analyst claims, replies, and closes a handed-off conversation', async ({ page }) => {
  await login(page, 'ana.souza@nexo.com.br');
  const creation = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/conversations') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  const conversationId = (await (await creation).json()).id as string;
  const chat = page.getByRole('region', { name: 'Conversa' });
  await chat.getByRole('button', { name: 'Falar com analista' }).click();
  await expect(chat.getByRole('status')).toContainText('Aguardando atendimento humano');
  await page.getByRole('button', { name: 'Sair' }).click();

  const item = page.locator(`[data-conversation-id="${conversationId}"]`);

  await login(page, 'analista@nexo.com.br');
  await page.getByRole('button', { name: 'Para você' }).click();
  await item.click();
  await page.getByRole('button', { name: 'Assumir atendimento' }).click();
  await expect(page.getByRole('status').first()).toContainText('Você está atendendo');
  await page.getByLabel('Resposta').fill('Já li o histórico.');
  await page.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(page.getByText('Já li o histórico.')).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();

  await login(page, 'ana.souza@nexo.com.br');
  const conversations = (await (await page.request.get('/api/conversations')).json()) as Array<{
    id: string;
  }>;
  const index = conversations.findIndex((conversation) => conversation.id === conversationId);
  await page.getByRole('button', { name: `Conversa ${index + 1}`, exact: true }).click();
  await expect(page.getByText('Já li o histórico.')).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();

  await login(page, 'analista@nexo.com.br');
  await page.getByRole('button', { name: 'Minhas' }).click();
  await item.click();
  await page.getByRole('button', { name: 'Encerrar atendimento' }).click();
  await expect(page.getByRole('status').first()).toContainText('Atendimento encerrado');
});
