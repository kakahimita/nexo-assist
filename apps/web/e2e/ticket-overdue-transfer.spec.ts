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
  await page.setViewportSize({ width: 1440, height: 900 });
  await start(page);
  const chat = page.getByRole('region', { name: 'Conversa' });
  await send(page, 'Qual o status do meu chamado?');
  const choices = chat.getByRole('group', { name: 'Chamados encontrados' });
  await choices.getByRole('radio', { name: /Notebook lento.*prazo vencido/ }).check();
  await chat.getByRole('button', { name: 'Ver detalhes' }).click();
  await expect(chat.getByRole('status')).toContainText('Aguardando atendimento humano');
  const card = chat.getByRole('article', { name: 'Chamado Notebook lento' }).last();
  await expect(card.getByText('Prazo vencido')).toBeVisible();
  await page.screenshot({ path: 'outputs/ticket-overdue-transfer-desktop.png', fullPage: true });
  const handoffMessage = chat.locator('article.chat-message.agent', { has: card });
  await expect(handoffMessage.getByRole('button', { name: /Notebook lento/ })).toHaveCount(0);
  await page.reload();
  await page
    .getByRole('button', { name: /Conversa/ })
    .last()
    .click();
  const restored = page.getByRole('region', { name: 'Conversa' });
  await expect(restored.getByRole('status')).toContainText('Aguardando atendimento humano');
  const restoredCard = restored.getByRole('article', { name: 'Chamado Notebook lento' }).last();
  await expect(restoredCard.getByText('Prazo vencido')).toBeVisible();
  await expect(restoredCard).toContainText('Categoria: Hardware');
  await expect(restoredCard).toContainText(/Criado em: \d{2}\/\d{2}\/\d{4}/);
  const restoredMessage = restored.locator('article.chat-message.agent', { has: restoredCard });
  await expect(restoredMessage.locator('.ticket-options, .quick-replies')).toHaveCount(0);
  await expect(restoredMessage.getByRole('button')).toHaveCount(0);
});
