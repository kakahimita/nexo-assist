import { describe, expect, it } from 'vitest';
import { modelSafe } from './mastra-consultation-tools.js';

describe('model tool output sanitization', () => {
  it('removes null and undefined values that Gemini rejects in function responses', () => {
    expect(
      modelSafe({
        match: 'multiple',
        requestedQuery: null,
        tickets: [{ id: 't1', category: null, note: undefined, overdue: false }],
      }),
    ).toEqual({
      match: 'multiple',
      tickets: [{ id: 't1', overdue: false }],
    });
  });
});
