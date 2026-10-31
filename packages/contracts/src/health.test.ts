import { describe, expect, it } from 'vitest';

import {
  HealthResponseSchema,
  ReadinessResponseSchema,
  UnavailableResponseSchema,
} from './index.js';

describe('B17: shared health contracts', () => {
  it('B17: accepts the exact liveness payload', () => {
    expect(HealthResponseSchema.parse({ status: 'ok', service: 'nexo-api' })).toEqual({
      status: 'ok',
      service: 'nexo-api',
    });
  });

  it('B17: rejects a different service name', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok', service: 'other' }).success).toBe(false);
  });

  it('B17: rejects extra fields such as credentials', () => {
    expect(
      HealthResponseSchema.safeParse({ status: 'ok', service: 'nexo-api', key: 'secret' }).success,
    ).toBe(false);
  });

  it('B17: accepts the readiness payload', () => {
    expect(
      ReadinessResponseSchema.safeParse({ status: 'ok', service: 'nexo-api', database: 'ready' })
        .success,
    ).toBe(true);
  });

  it('B17: rejects readiness without database state', () => {
    expect(ReadinessResponseSchema.safeParse({ status: 'ok', service: 'nexo-api' }).success).toBe(
      false,
    );
  });

  it('B17: accepts the unavailable payload', () => {
    expect(
      UnavailableResponseSchema.safeParse({
        status: 'unavailable',
        service: 'nexo-api',
        database: 'unavailable',
      }).success,
    ).toBe(true);
  });
});
