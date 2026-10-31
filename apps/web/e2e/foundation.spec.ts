import { expect, test } from '@playwright/test';

test('B17 / PRD pp. 2–3: browser reaches the real API', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('status')).toHaveText('API conectada');
});

test('B17 / PRD pp. 2–3: shows loading until the health request completes', async ({ page }) => {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });

  await page.route('**/api/health', async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Verificando conexão...');
  release();
  await expect(page.getByRole('status')).toHaveText('API conectada');
});

test('B17 / PRD pp. 2–3: reports an HTTP failure and recovers with keyboard retry', async ({
  page,
}) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'unavailable' }),
    }),
  );

  await page.goto('/');
  const alert = page
    .getByRole('alert')
    .filter({ hasText: 'Não foi possível conectar à API.' });
  await expect(alert).toBeVisible();

  await page.unroute('**/api/health');
  const retry = page.getByRole('button', { name: 'Tentar novamente' });
  await retry.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('status')).toHaveText('API conectada');
});

test('B17 / PRD pp. 2–3: times out a stalled health request', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/health', async () => {
    await new Promise(() => undefined);
  });

  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Verificando conexão...');
  await page.clock.fastForward(6_000);
  const alert = page
    .getByRole('alert')
    .filter({ hasText: 'Não foi possível conectar à API.' });
  await expect(alert).toBeVisible();
});

test('B17 / PRD pp. 2–3: keeps the diagnostic page within narrow and desktop widths', async ({
  page,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Nexo Assist' })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  }
});
