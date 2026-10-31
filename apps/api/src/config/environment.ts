import { resolve } from 'node:path';

import { config as loadEnvironment } from 'dotenv';

import { REPOSITORY_ROOT, resolveDatabaseUrl } from './paths.js';

export interface ApiEnvironment {
  host: string;
  port: number;
  webOrigin: string;
  databaseUrl: string;
}

const DEFAULTS = {
  host: '127.0.0.1',
  port: '3001',
  webOrigin: 'http://localhost:3000',
  databaseUrl: 'file:./data/nexo.db',
} as const;

function readValue(input: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const value = input[name];

  if (value === undefined) {
    return fallback;
  }

  if (value.trim() === '') {
    throw new Error(`${name} must not be blank.`);
  }

  return value;
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined) {
    return Number(DEFAULTS.port);
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parseWebOrigin(raw: string | undefined): string {
  if (raw === undefined) {
    return DEFAULTS.webOrigin;
  }

  if (raw.trim() === '' || raw.trim() === '*') {
    throw new Error('WEB_ORIGIN must be a single HTTP(S) origin.');
  }

  let origin: URL;

  try {
    origin = new URL(raw);
  } catch {
    throw new Error('WEB_ORIGIN must be a single HTTP(S) origin.');
  }

  const isHttp = origin.protocol === 'http:' || origin.protocol === 'https:';
  const isSingleOrigin =
    origin.username === '' &&
    origin.password === '' &&
    origin.pathname === '/' &&
    origin.search === '' &&
    origin.hash === '';

  if (!isHttp || !isSingleOrigin) {
    throw new Error('WEB_ORIGIN must be a single HTTP(S) origin.');
  }

  return origin.origin;
}

export function parseApiEnvironment(input: NodeJS.ProcessEnv): ApiEnvironment {
  return {
    host: readValue(input, 'API_HOST', DEFAULTS.host),
    port: parsePort(input.API_PORT),
    webOrigin: parseWebOrigin(input.WEB_ORIGIN),
    databaseUrl: resolveDatabaseUrl(readValue(input, 'DATABASE_URL', DEFAULTS.databaseUrl)),
  };
}

export function loadApiEnvironment(): ApiEnvironment {
  loadEnvironment({ path: resolve(REPOSITORY_ROOT, '.env'), override: false, quiet: true });

  return parseApiEnvironment(process.env);
}
