import { expect, test } from '@playwright/test';
import { startFreshConversation } from './employee-chat';

test('B14: message cap preserves history and offers a new conversation', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
  const id = await startFreshConversation(page);
  for (let i = 0; i < 28; i++)
    expect(
      (
        await page.request.post(`/api/conversations/${id}/messages`, {
          headers: { origin: new URL(page.url()).origin },
          data: { content: `Mensagem ${i}` },
        })
      ).status(),
    ).toBe(201);
  await page.reload();
  const conversations = (await (await page.request.get('/api/conversations')).json()) as Array<{
    id: string;
  }>;
  const index = conversations.findIndex((conversation) => conversation.id === id);
  expect(index).toBeGreaterThanOrEqual(0);
  expect(conversations.at(-1)?.id).toBe(id);
  const chat = page.getByRole('region', { name: 'Conversa' });
  await expect(chat.getByText('28/30 mensagens nesta sessão')).toBeVisible();
  await chat.getByLabel('Mensagem').fill('Meu notebook não conecta na VPN e mostra o erro 809');
  await chat.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(chat.getByText('29/30 mensagens nesta sessão')).toBeVisible();
  await chat.getByRole('button', { name: 'Windows 11' }).click();
  await expect(chat.getByText('30/30 mensagens nesta sessão')).toBeVisible();
  await expect(chat.getByLabel('Mensagem')).toBeDisabled();
  await expect(chat.getByRole('status')).toContainText('limite de 30 mensagens');
  const rejected = await page.request.post(`/api/conversations/${id}/messages`, {
    headers: { origin: new URL(page.url()).origin },
    data: { content: 'excesso' },
  });
  expect(rejected.status()).toBe(409);
  expect((await rejected.json()).code).toBe('session_limit');
  await chat.getByRole('button', { name: 'Nova conversa' }).click();
  await expect(chat.getByText('0/30 mensagens nesta sessão')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Conversas' })).toHaveCount(0);
});

test('B14: a stale tab displays the server count after a limit rejection', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('x');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await startFreshConversation(page);
  await page.route('**/api/conversations/*/messages/stream', (route) =>
    route.fulfill({ status: 409, json: { code: 'session_limit', limit: 30, used: 30 } }),
  );
  const chat = page.getByRole('region', { name: 'Conversa' });
  await chat.getByLabel('Mensagem').fill('Teste');
  await chat.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(chat.getByText('30/30 mensagens nesta sessão')).toBeVisible();
  await expect(chat.getByLabel('Mensagem')).toBeDisabled();
});
