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

test('B09 B10 B13: an overdue ticket transfers the conversation and keeps it after reload', async ({
  page,
}) => {
  await start(page);
  const chat = page.getByRole('region', { name: 'Conversa' });
  await send(page, 'Qual o status do meu chamado?');
  await chat
    .getByRole('button', { name: /Notebook lento/ })
    .last()
    .click();
  await expect(chat.getByRole('status')).toContainText('Aguardando atendimento humano');
  const card = chat.getByRole('article', { name: 'Chamado Notebook lento' }).last();
  await expect(card.getByText('Prazo vencido')).toBeVisible();
  const handoffMessage = chat.locator('article.chat-message.agent', { has: card });
  await expect(handoffMessage.getByRole('button', { name: /Notebook lento/ })).toHaveCount(0);
  await page.reload();
  await page
    .getByRole('button', { name: /Conversa/ })
    .last()
    .click();
  const restored = page.getByRole('region', { name: 'Conversa' });
  await expect(restored.getByRole('status')).toContainText('Aguardando atendimento humano');
  await expect(
    restored
      .getByRole('article', { name: 'Chamado Notebook lento' })
      .last()
      .getByText('Prazo vencido'),
  ).toBeVisible();
});
