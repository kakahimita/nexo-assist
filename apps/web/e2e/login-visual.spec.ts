import { expect, test } from '@playwright/test';

test('V01: login fits desktop and narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await page.screenshot({ path: 'outputs/login-1440.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('V01: password visibility can be toggled with the keyboard', async ({ page }) => {
  await page.goto('/');
  const password = page.getByLabel('Senha', { exact: true });
  await password.fill('exemplo');
  const toggle = page.getByRole('button', { name: 'Mostrar senha' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Ocultar senha' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveValue('exemplo');
});

test('V01: unavailable recovery and persistent login are identified', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Ramal 4000 (exemplo)')).toBeVisible();
  await expect(page.getByRole('button', { name: /Esqueci minha senha/ })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: /Manter conectado/ })).toBeDisabled();
  await expect(page.getByText('Recuperação de senha e a opção de manter conectado ainda não estão disponíveis.')).toBeVisible();
});
