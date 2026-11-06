import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
]) {
  test(`V01: complete login needs no scrolling at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByLabel('Chave de API do Gemini')).toBeVisible();
    await page.route('**/api/session/model-key', (route) =>
      route.fulfill({ status: 201, json: { configured: true } }),
    );
    await page.getByLabel('Chave de API do Gemini').fill('test-session-key');
    await page.getByRole('button', { name: 'Usar chave nesta sessão' }).click();
    await expect(page.getByText('Chave configurada para esta sessão.')).toBeVisible();
    await page.route('**/api/session', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 401, json: {} })
        : route.continue(),
    );
    await page.getByLabel('E-mail corporativo').fill('unknown@nexo.com.br');
    await page.getByLabel('Senha', { exact: true }).fill('demo');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(
      page.getByText('Não foi possível entrar. Confira os dados ou tente novamente.'),
    ).toBeVisible();
    const layout = await page
      .locator(
        '.intro, .login-main, .login-center, .login-form, .login-heading, .login-fields, .login-demo, .demo-model-key, .login-footer',
      )
      .evaluateAll((elements) =>
        elements.map((element) => ({
          section: element.className,
          height: element.getBoundingClientRect().height,
        })),
      );
    expect(
      await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      })),
      JSON.stringify(layout),
    ).toEqual({ width: viewport.width, height: viewport.height });
    for (const locator of [
      page.getByLabel('Chave de API do Gemini'),
      page.getByRole('button', { name: 'Entrar', exact: true }),
      page.locator('.demo-model-key-warning'),
      page.getByRole('link', { name: 'Saiba como criar uma chave' }),
      page.locator('.login-footer'),
      page.getByLabel('Indicadores de atendimento', { exact: true }),
    ]) {
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.screenshot({ path: `outputs/login-fit-${viewport.width}.png`, fullPage: true });
  });
}

test('V01: login fits desktop and narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await page.screenshot({ path: 'outputs/login-1440.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
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
  await expect(
    page.getByText(
      'Recuperação de senha e a opção de manter conectado ainda não estão disponíveis.',
    ),
  ).toBeVisible();
});

test('V01: a demo Gemini key can be configured for the current session', async ({ page }) => {
  await page.goto('/');
  const key = page.getByLabel('Chave de API do Gemini');
  const submit = page.getByRole('button', { name: 'Entrar', exact: true });
  const card = page.locator('.demo-model-key');
  const [submitBox, cardBox] = await Promise.all([submit.boundingBox(), card.boundingBox()]);
  expect(cardBox).not.toBeNull();
  expect(submitBox).not.toBeNull();
  expect(cardBox!.y).toBeGreaterThan(submitBox!.y);
  expect(
    Math.abs(cardBox!.x + cardBox!.width / 2 - (submitBox!.x + submitBox!.width / 2)),
  ).toBeLessThan(2);
  await expect(key).toHaveAttribute('type', 'password');
  await key.fill('key-not-rendered-after-submit');
  await page.getByRole('button', { name: 'Usar chave nesta sessão' }).click();
  await expect(page.getByRole('status')).toHaveText('Chave configurada para esta sessão.');
  await expect(key).toHaveValue('');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
