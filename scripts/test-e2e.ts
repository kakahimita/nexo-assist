import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

import { createTestDatabase } from '../apps/api/test/support/test-database.js';

const repositoryRoot = resolve(import.meta.dirname, '..');
const apiEntrypoint = resolve(repositoryRoot, 'apps', 'api', 'dist', 'main.js');
const webBuildDirectory = resolve(repositoryRoot, 'apps', 'web', '.next');
const nextCli = resolve(repositoryRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const playwrightCli = resolve(repositoryRoot, 'node_modules', '@playwright', 'test', 'cli.js');

const apiUrl = 'http://127.0.0.1:3001/api';
const webUrl = 'http://localhost:3000';
const webReadinessUrl = 'http://127.0.0.1:3000';
const startupDeadlineMs = 30_000;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolvePort) => {
    const server = createServer();

    server.once('error', () => resolvePort(false));
    server.once('listening', () => {
      server.close(() => resolvePort(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function waitForUrl(url: string, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });

      if (response.ok) {
        return;
      }
    } catch {
      // The process may still be starting; retry until the deadline.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

async function stopProcess(child: ChildProcess | undefined): Promise<void> {
  if (child === undefined || child.exitCode !== null) {
    return;
  }

  child.kill();

  await new Promise<void>((resolveStop) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolveStop();
    }, 5_000);

    child.once('exit', () => {
      clearTimeout(timer);
      resolveStop();
    });
  });
}

export async function runFoundationBrowserTests(): Promise<number> {
  if (!existsSync(apiEntrypoint) || !existsSync(webBuildDirectory)) {
    throw new Error('Build output is missing. Run `npm run build` before `npm run test:e2e`.');
  }

  for (const [port, label] of [
    [3000, 'web'],
    [3001, 'API'],
  ] as const) {
    if (!(await isPortFree(port))) {
      throw new Error(
        `Port ${port} (${label}) is already in use. Stop that process before running the browser checks.`,
      );
    }
  }

  const database = await createTestDatabase();
  let apiProcess: ChildProcess | undefined;
  let webProcess: ChildProcess | undefined;

  try {
    apiProcess = spawn(process.execPath, [apiEntrypoint], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        API_HOST: '127.0.0.1',
        API_PORT: '3001',
        WEB_ORIGIN: webUrl,
        DATABASE_URL: database.url,
      },
      shell: false,
      stdio: 'inherit',
    });

    webProcess = spawn(process.execPath, [nextCli, 'start', '-p', '3000'], {
      cwd: resolve(repositoryRoot, 'apps', 'web'),
      env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: apiUrl },
      shell: false,
      stdio: 'inherit',
    });

    const deadline = Date.now() + startupDeadlineMs;
    await Promise.all([waitForUrl(`${apiUrl}/ready`, deadline), waitForUrl(webReadinessUrl, deadline)]);

    const playwright = spawn(process.execPath, [playwrightCli, 'test'], {
      cwd: repositoryRoot,
      env: process.env,
      shell: false,
      stdio: 'inherit',
    });

    return await new Promise<number>((resolveExit, rejectExit) => {
      playwright.once('error', rejectExit);
      playwright.once('exit', (code) => resolveExit(code ?? 1));
    });
  } finally {
    await stopProcess(webProcess);
    await stopProcess(apiProcess);
    await database.cleanup();
  }
}

try {
  process.exitCode = await runFoundationBrowserTests();
} catch (error) {
  console.error(
    `Browser verification failed: ${error instanceof Error ? error.message : 'unknown error'}`,
  );
  process.exitCode = 1;
}
