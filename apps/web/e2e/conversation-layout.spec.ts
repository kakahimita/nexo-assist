import { expect, test } from '@playwright/test';

test('V02 V03: composer remains usable beside its send action on desktop and mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('qualquer');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  const message = page.getByLabel('Mensagem');
  const send = page.getByRole('button', { name: 'Enviar mensagem' });
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
  await expect(page.getByText('Olá', { exact: true })).toBeVisible();
  await expect(page.getByText('Mensagens: 1 de 30')).toBeVisible();
});
