import { describe, expect, it } from 'vitest';
import { mapMastraChunk } from './mastra-consultation.js';
const decision = {
  intent: 'VPN',
  action: 'answer',
  appliedRule: 'IT',
  confidence: 0.8,
  justification: 'Artigo',
  missingFacts: [],
  quickReplies: [],
};
describe('Mastra stream mapping', () => {
  it('maps text, final tool results and structured output, ignoring preliminary data', () => {
    expect(mapMastraChunk({ type: 'text-delta', payload: { id: 'a', text: 'Olá' } })).toEqual({
      type: 'text-delta',
      text: 'Olá',
    });
    expect(
      mapMastraChunk({
        type: 'tool-result',
        payload: { toolCallId: 'a', toolName: 'consult-tickets', result: {}, preliminary: true },
      }),
    ).toBeNull();
    expect(
      mapMastraChunk({
        type: 'tool-result',
        payload: { toolCallId: 'a', toolName: 'consult-tickets', result: {}, isError: true },
      }),
    ).toMatchObject({ type: 'tool-result', toolCallId: 'a', isError: true });
    expect(mapMastraChunk({ type: 'object-result', object: decision })).toEqual({
      type: 'decision',
      decision,
    });
    expect(
      mapMastraChunk({
        type: 'tool-result',
        payload: {
          toolCallId: 'd',
          toolName: 'propose-ticket-draft',
          result: { status: 'draft', draftId: 'd1' },
        },
      }),
    ).toMatchObject({ type: 'tool-result', tool: 'propose-ticket-draft' });
  });
  it('does not expose provider errors and rejects non-stop finishes', () => {
    expect(
      mapMastraChunk({
        type: 'tool-error',
        payload: { toolCallId: 'x', toolName: 'search-knowledge', error: 'secret' },
      }),
    ).toMatchObject({ type: 'tool-error', toolCallId: 'x' });
    expect(() => mapMastraChunk({ type: 'error', payload: { error: 'secret' } })).toThrow(
      'model_unavailable',
    );
    expect(() => mapMastraChunk({ type: 'abort', payload: {} })).toThrow('interrupted');
    expect(
      mapMastraChunk({ type: 'finish', payload: { stepResult: { reason: 'stop' }, output: {} } }),
    ).toMatchObject({ type: 'finish' });
    for (const reason of ['length', 'content-filter', 'tool-calls', 'unknown'])
      expect(() =>
        mapMastraChunk({ type: 'finish', payload: { stepResult: { reason }, output: {} } }),
      ).toThrow('invalid_output');
  });
});
