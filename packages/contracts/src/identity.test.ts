import { describe, expect, it } from 'vitest';
import { LoginInputSchema, UserViewSchema } from './identity.js';

describe('B01 identity contracts', () => {
  it('accepts a known-shaped login and rejects malformed inputs', () => {
    expect(LoginInputSchema.safeParse({ email: 'ana.souza@nexo.com.br', password: 'x' }).success).toBe(true);
    expect(LoginInputSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(false);
    expect(LoginInputSchema.safeParse({ email: 'ana.souza@nexo.com.br', password: '' }).success).toBe(false);
    expect(LoginInputSchema.safeParse({ email: 'ana.souza@nexo.com.br', password: 'x', role: 'analyst' }).success).toBe(false);
  });
  it('validates the public user role', () => {
    expect(UserViewSchema.safeParse({ id: '1', name: 'Ana', email: 'ana.souza@nexo.com.br', role: 'employee' }).success).toBe(true);
  });
});
