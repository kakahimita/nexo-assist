import { describe, expect, it } from 'vitest';
import { SessionModelKeyStore } from './session-model-key.store.js';

describe('SessionModelKeyStore', () => {
  it('moves a temporary key to the authenticated session and clears it', () => {
    const store = new SessionModelKeyStore();
    const temporaryToken = store.create('demo-key');

    expect(store.read(temporaryToken)).toBe('demo-key');

    store.claim(temporaryToken, 'authenticated-session');

    expect(store.read(temporaryToken)).toBeUndefined();
    expect(store.read('authenticated-session')).toBe('demo-key');

    store.clear('authenticated-session');

    expect(store.read('authenticated-session')).toBeUndefined();
  });
});
