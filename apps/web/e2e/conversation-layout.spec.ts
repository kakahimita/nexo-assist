import { expect, test } from '@playwright/test';
import { startFreshConversation } from './employee-chat';

test('V02 V03: composer remains usable beside its send action on desktop and mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('qualquer');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await startFreshConversation(page);
  const heading = await page.getByRole('heading', { name: 'Mensagens' }).boundingBox();
  expect(heading?.width).toBeLessThanOrEqual(1);
  const composer = await page.locator('.consultation-composer').boundingBox();
  expect(composer).not.toBeNull();
  expect(composer!.y).toBeGreaterThan(750);
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(900);
  const message = page.getByLabel('Mensagem');
  const send = page.getByRole('button', { name: 'Enviar' });
  await expect(send.locator('svg')).toBeVisible();
  expect(await message.evaluate((element) => getComputedStyle(element).overflowY)).toBe('hidden');
  expect(await send.evaluate((element) => getComputedStyle(element).minHeight)).toBe('36px');
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const input = await message.boundingBox();
    const button = await send.boundingBox();
    expect(input).not.toBeNull();
    expect(button).not.toBeNull();
    expect(button!.x).toBeGreaterThan(input!.x);
    expect(button!.y).toBeLessThan(input!.y + input!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await message.fill('Olá');
  await send.focus();
  await page.keyboard.press('Enter');
  const chat = page.getByRole('region', { name: 'Conversa' });
  await expect(chat.locator('.chat-message.employee').last()).toHaveAttribute('aria-label', 'Você');
  await expect(
    chat.locator('.chat-message.agent').last().getByText('Nexo Assist', { exact: true }),
  ).toBeVisible();
  await expect(chat.getByText('Olá', { exact: true })).toBeVisible();
  await expect(page.getByText('1/30 mensagens nesta sessão')).toBeVisible();
});

test('V03: a long employee conversation scrolls only inside the message panel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('qualquer');
  await page.getByRole('button', { name: 'Entrar' }).click();
  const id = await startFreshConversation(page);
  const messages = Array.from({ length: 14 }, (_, index) => ({
    id: `history-${index}`,
    content: `Mensagem de histórico ${index}`,
    createdAt: '2026-11-05T12:00:00.000Z',
    role: 'employee' as const,
    status: 'completed' as const,
    decision: null,
    authorName: null,
  }));
  await page.route(`**/api/conversations/${id}/messages`, (route) =>
    route.fulfill({ json: messages }),
  );

  await page.reload();
  await expect(page.getByText('Mensagem de histórico 13')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight),
  ).toBe(true);
  expect(
    await page
      .locator('.consultation-messages')
      .evaluate((element) => element.scrollHeight > element.clientHeight),
  ).toBe(true);
});
