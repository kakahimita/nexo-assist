import { describe, expect, it } from 'vitest';
import { assertSuccessfulFinish } from './mastra-smoke.js';

describe('model finish reason', () => {
  it('accepts a normal stop', () => {
    expect(() => assertSuccessfulFinish('stop')).not.toThrow();
  });
  it.each(['length', 'content-filter', 'error', 'tripwire', 'retry', 'tool-calls', 'unknown'])(
    'rejects %s after partial evidence', (reason) => {
      expect(() => assertSuccessfulFinish(reason)).toThrow();
    },
  );
});
