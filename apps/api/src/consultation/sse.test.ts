import { describe, expect, it } from 'vitest';
import { encodeSse } from './sse.js';
describe('SSE encoding', () => {
  it('encodes validated events on a single data line', () => {
    expect(encodeSse({ type: 'text-delta', text: 'Olá\nmundo' })).toBe(
      'data: {"type":"text-delta","text":"Olá\\nmundo"}\n\n',
    );
    expect(() =>
      encodeSse({ type: 'text-delta', text: 'x', ownerId: 'forged' } as never),
    ).toThrow();
    expect(() => encodeSse({ type: 'text-delta', text: BigInt(1) } as never)).toThrow();
  });
});
