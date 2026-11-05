import { expect, test } from '@playwright/test';
import { startFreshConversation } from './employee-chat';

async function start(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await startFreshConversation(page);
}

test('B09 B10 B13: employee can request human support and continue sending messages', async ({
  page,
}) => {
  await start(page);
  const chat = page.getByRole('region', { name: 'Conversa' });

  const conversations = (await (await page.request.get('/api/conversations')).json()) as Array<{
    id: string;
  }>;
  const id = conversations.at(-1)!.id;
  expect(
    (
      await page.request.post(`/api/conversations/${id}/handoff`, {
        headers: { origin: new URL(page.url()).origin },
        data: { reason: 'employee_request' },
      })
    ).status(),
  ).toBe(201);
  await page.reload();
  await expect(chat.getByRole('status')).toContainText('Aguardando atendimento humano');
  await expect(chat.getByRole('button', { name: 'Falar com um analista' })).toHaveCount(0);

  await chat.getByLabel('Mensagem').fill('Ainda preciso de ajuda');
  await chat.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(chat.getByText('Ainda preciso de ajuda')).toBeVisible();
  await expect(chat.getByRole('status')).toContainText('Aguardando atendimento humano');
  await expect(chat.getByText('Nexo Assist')).toHaveCount(0);
});
