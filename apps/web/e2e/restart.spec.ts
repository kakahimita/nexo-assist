import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';

test('B13: browser history survives restarting the API process', async ({ page }) => {
  const directory = await mkdtemp(join(tmpdir(), 'nexo-browser-restart-'));
  const databaseUrl = `file:${join(directory, 'test.db').replaceAll('\\', '/')}`;
  const exec = promisify(execFile);
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  await exec(process.execPath, [resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { cwd: resolve('apps/api'), env });
  await exec(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), resolve('apps/api/src/database/initialize.ts')], { env });
  const listener = createServer();
  const port = await new Promise<number>((done, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address();
      if (!address || typeof address === 'string') return reject(new Error('No test port'));
      listener.close(() => done(address.port));
    });
  });
  let api: ChildProcess | undefined;
  async function stop() {
    if (!api || api.exitCode !== null) return;
    const running = api;
    const exited = new Promise<void>((done) => running.once('exit', () => done()));
    running.kill();
    await exited;
  }
  async function start() {
    api = spawn(process.execPath, [resolve('apps/api/dist/main.js')], { env: { ...process.env, API_HOST: '127.0.0.1', API_PORT: String(port), WEB_ORIGIN: 'http://localhost:3000', DATABASE_URL: databaseUrl }, stdio: 'ignore' });
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/api/ready`)).ok) return; } catch { /* wait for startup */ }
      await new Promise((done) => setTimeout(done, 100));
    }
    throw new Error('Test API failed to start');
  }
  try {
    await start();
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const response = await route.fetch({ url: `http://127.0.0.1:${port}${path}` });
      await route.fulfill({ response });
    });
    await page.goto('/');
    await page.getByLabel('E-mail corporativo').fill('ana.souza@nexo.com.br');
    await page.getByLabel('Senha').fill('x');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.getByRole('button', { name: 'Nova conversa' }).click();
    await page.getByLabel('Mensagem').fill('Histórico após reinício');
    await page.getByRole('button', { name: 'Salvar mensagem' }).click();
    await expect(page.getByText('Histórico após reinício')).toBeVisible();
    await stop();
    await start();
    await page.reload();
    await page.getByRole('button', { name: 'Conversa 1' }).click();
    await expect(page.getByText('Histórico após reinício')).toBeVisible();
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});
