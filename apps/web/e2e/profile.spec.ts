import { expect, test } from '@playwright/test';

async function signInAsAna(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
  await page.getByLabel('Senha', { exact: true }).fill('qualquer');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

test('V03/V06: signed-in employee shows initials and ready assistant availability', async ({
  page,
}) => {
  await page.route('**/api/ready', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', service: 'nexo-api', database: 'ready' }),
    }),
  );

  await signInAsAna(page);

  await expect(page.locator('.employee-avatar')).toHaveText('AS');
  await expect(page.getByRole('status', { name: 'Assistente online' })).toBeVisible();
});

test('V03: employee top bar reports availability while readiness is pending', async ({ page }) => {
  await page.route('**/api/ready', () => new Promise(() => undefined));

  await signInAsAna(page);

  await expect(page.getByRole('status', { name: 'Verificando disponibilidade' })).toBeVisible();
});

test('V03: employee can retry after an unavailable assistant check', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/ready', (route) => {
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503 });

    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', service: 'nexo-api', database: 'ready' }),
    });
  });

  await signInAsAna(page);

  await expect(page.getByRole('status', { name: 'Assistente indisponível' })).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('status', { name: 'Assistente online' })).toBeVisible();
});

test('V03/V06: employee avatar and availability do not overflow a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/ready', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', service: 'nexo-api', database: 'ready' }),
    }),
  );

  await signInAsAna(page);

  await expect(page.locator('.employee-avatar')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Assistente online' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
});

test('V06: profile displays the signed-in employee and preserves the conversation', async ({
  page,
}) => {
  await signInAsAna(page);
  await page.getByRole('button', { name: 'Nova conversa' }).click();
  await page.getByLabel('Mensagem').fill('Texto ainda não enviado');
  await page.getByRole('button', { name: 'Meu perfil' }).click();
  await expect(page.getByRole('heading', { name: 'Meu perfil' })).toBeVisible();
  const profile = page.getByRole('region', { name: 'Meu perfil' });
  await expect(profile.getByText('ana.souza@nexo.com.br')).toBeVisible();
  await expect(profile.getByText('Ana Souza', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /redefinir senha/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Atendimento' }).click();
  await expect(page.getByLabel('Mensagem')).toHaveValue('Texto ainda não enviado');
});
