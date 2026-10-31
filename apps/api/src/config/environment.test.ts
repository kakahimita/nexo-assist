import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseApiEnvironment } from './environment.js';
import { REPOSITORY_ROOT } from './paths.js';

describe('B17: validated API environment', () => {
  it('B17: applies the documented template defaults', () => {
    const environment = parseApiEnvironment({});

    expect(environment).toMatchObject({
      host: '127.0.0.1',
      port: 3001,
      webOrigin: 'http://localhost:3000',
    });
    expect(environment.databaseUrl).toBe(
      `file:${resolve(REPOSITORY_ROOT, 'data', 'nexo.db').replaceAll('\\', '/')}`,
    );
  });

  it('B17: accepts explicit valid values', () => {
    const environment = parseApiEnvironment({
      API_HOST: '0.0.0.0',
      API_PORT: '3002',
      WEB_ORIGIN: 'https://nexo.example',
      DATABASE_URL: 'file:./var/test.db',
    });

    expect(environment).toMatchObject({
      host: '0.0.0.0',
      port: 3002,
      webOrigin: 'https://nexo.example',
    });
    expect(environment.databaseUrl).toBe(
      `file:${resolve(REPOSITORY_ROOT, 'var', 'test.db').replaceAll('\\', '/')}`,
    );
  });

  it.each(['0', '65536', 'abc', ''])(
    'B17: rejects invalid API_PORT without exposing it',
    (value) => {
      expect(() => parseApiEnvironment({ API_PORT: value })).toThrow('API_PORT');
    },
  );

  it('B17: rejects invalid ports without exposing their value', () => {
    const sentinel = 'sentinel-secret-value';

    expect(() => parseApiEnvironment({ API_PORT: sentinel })).toThrow('API_PORT');
    expect(() => parseApiEnvironment({ API_PORT: sentinel })).not.toThrow(sentinel);
  });

  it.each(['*', '', 'http://localhost:3000/path', 'ftp://localhost:3000', 'http://user:pass@localhost:3000'])(
    'B17: rejects an invalid WEB_ORIGIN without exposing it',
    (value) => {
      expect(() => parseApiEnvironment({ WEB_ORIGIN: value })).toThrow('WEB_ORIGIN');
    },
  );

  it('B17: rejects a blank DATABASE_URL', () => {
    expect(() => parseApiEnvironment({ DATABASE_URL: '' })).toThrow('DATABASE_URL');
    expect(() => parseApiEnvironment({ DATABASE_URL: 'https://example.test/db' })).toThrow(
      'DATABASE_URL',
    );
  });

  it('B17: starts ordinary configuration without a model key', () => {
    expect(parseApiEnvironment({}).port).toBe(3001);
    expect(parseApiEnvironment({ GOOGLE_API_KEY: '' }).port).toBe(3001);
  });
});
