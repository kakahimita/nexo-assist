import { expect, test } from '@playwright/test';

test('V02 V06: employee navigation works with keyboard at desktop and narrow widths', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('qualquer');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  await page.getByLabel('Mensagem').fill('Texto não enviado');
  const navigation = page.getByRole('navigation', { name: 'Navegação principal' });
  const navBox = await navigation.boundingBox();
  const mainBox = await page.getByRole('main').boundingBox();
  expect(navBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  expect(navBox!.x).toBeLessThan(mainBox!.x);
  const profile = navigation.getByRole('button', { name: 'Meu perfil' });
  await profile.focus();
  await page.keyboard.press('Enter');
  await expect(profile).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
  await navigation.getByRole('button', { name: 'Atendimento' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Mensagem')).toHaveValue('Texto não enviado');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(profile).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
