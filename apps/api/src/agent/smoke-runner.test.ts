import { describe, expect, it, vi } from 'vitest';

import { formatSmokeFailure, runSmoke } from './smoke-runner.js';
import type { SmokeEvent, SmokeTransport } from './smoke-runner.js';

const NONCE = '123e4567-e89b-42d3-a456-426614174000';
const INCOMPLETE_MESSAGE = 'O teste não comprovou a execução da ferramenta e o streaming.';

const matchingToolResult: SmokeEvent = {
  type: 'tool-result',
  nonce: NONCE,
  source: 'foundation-smoke',
};

function transportFrom(events: SmokeEvent[]): {
  transport: SmokeTransport;
  run: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn(async function* generate(): AsyncGenerator<SmokeEvent> {
    for (const event of events) {
      yield event;
    }
  });

  return { transport: { run }, run };
}

function failingTransport(
  error: unknown,
  events: SmokeEvent[] = [],
): { transport: SmokeTransport; run: ReturnType<typeof vi.fn> } {
  const run = vi.fn(async function* generate(): AsyncGenerator<SmokeEvent> {
    for (const event of events) {
      yield event;
    }

    throw error;
  });

  return { transport: { run }, run };
}

function runOptions(onText = vi.fn()): Parameters<typeof runSmoke>[1] {
  return {
    provider: 'fake',
    model: 'deterministic',
    nonce: NONCE,
    signal: new AbortController().signal,
    onText,
  };
}

describe('runSmoke', () => {
  it('B17: requires observed tool and streamed evidence', async () => {
    const onText = vi.fn();
    const { transport, run } = transportFrom([
      matchingToolResult,
      { type: 'text-delta', text: 'OK ' },
      { type: 'text-delta', text: NONCE },
      {
        type: 'finish',
        usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 },
      },
    ]);

    const evidence = await runSmoke(transport, runOptions(onText));

    expect(evidence).toMatchObject({
      provider: 'fake',
      model: 'deterministic',
      toolExecutions: 1,
      textChunks: 2,
      text: `OK ${NONCE}`,
      promptVersion: 'foundation-v1',
      usage: { inputTokens: 11, outputTokens: 7, totalTokens: 18 },
    });
    expect(evidence.durationMs).toBeGreaterThanOrEqual(0);
    expect(onText.mock.calls.map(([chunk]) => chunk)).toEqual(['OK ', NONCE]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(NONCE, expect.any(AbortSignal));
  });

  it('B17: omits usage metrics the provider did not report', async () => {
    const { transport } = transportFrom([
      matchingToolResult,
      { type: 'text-delta', text: `OK ${NONCE}` },
      { type: 'finish' },
    ]);

    const evidence = await runSmoke(transport, runOptions());

    expect(evidence.usage).toBeUndefined();
  });

  it.each([
    [
      'text without a tool event',
      [
        { type: 'text-delta', text: `OK ${NONCE}` },
        { type: 'finish' },
      ] satisfies SmokeEvent[],
    ],
    [
      'a mismatched nonce',
      [
        { type: 'tool-result', nonce: '123e4567-e89b-42d3-a456-426614174001', source: 'foundation-smoke' },
        { type: 'text-delta', text: `OK ${NONCE}` },
        { type: 'finish' },
      ] satisfies SmokeEvent[],
    ],
    [
      'zero text chunks',
      [matchingToolResult, { type: 'finish' }] satisfies SmokeEvent[],
    ],
    [
      'no finish event',
      [matchingToolResult, { type: 'text-delta', text: `OK ${NONCE}` }] satisfies SmokeEvent[],
    ],
    [
      'a tool-only result',
      [matchingToolResult, { type: 'finish' }] satisfies SmokeEvent[],
    ],
    [
      'text that omits the nonce',
      [
        matchingToolResult,
        { type: 'text-delta', text: 'OK' },
        { type: 'finish' },
      ] satisfies SmokeEvent[],
    ],
  ])('B17: rejects %s as incomplete evidence', async (_label, events) => {
    const { transport, run } = transportFrom(events);

    await expect(runSmoke(transport, runOptions())).rejects.toThrow(INCOMPLETE_MESSAGE);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('B17: propagates a quota failure after partial text without retrying', async () => {
    const quotaError = Object.assign(new Error('quota sentinel'), { statusCode: 429 });
    const { transport, run } = failingTransport(quotaError, [
      matchingToolResult,
      { type: 'text-delta', text: 'OK ' },
    ]);

    await expect(runSmoke(transport, runOptions())).rejects.toBe(quotaError);
    expect(run).toHaveBeenCalledTimes(1);
    expect(formatSmokeFailure(quotaError)).toBe(
      'Cota do provedor esgotada. Aguarde a renovação ou verifique os limites da conta.',
    );
  });

  it('B17: propagates an abort without retrying', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    const { transport, run } = failingTransport(abortError);

    await expect(runSmoke(transport, runOptions())).rejects.toBe(abortError);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('formatSmokeFailure', () => {
  it.each([401, 403])('B17: maps status %i to a permission failure', (statusCode) => {
    expect(formatSmokeFailure({ statusCode, message: 'sentinel-secret' })).toBe(
      'Acesso ao provedor recusado. Verifique a chave e as permissões locais.',
    );
  });

  it('B17: maps 404 to a model availability failure', () => {
    expect(formatSmokeFailure({ statusCode: 404 })).toBe(
      'Modelo indisponível. Verifique MODEL_NAME e o acesso da conta.',
    );
  });

  it('B17: maps 429 to a quota failure without leaking provider text', () => {
    const message = formatSmokeFailure({ statusCode: 429, message: 'sentinel-secret' });

    expect(message).toBe(
      'Cota do provedor esgotada. Aguarde a renovação ou verifique os limites da conta.',
    );
    expect(message).not.toContain('sentinel-secret');
  });

  it('B17: maps an abort to the timeout message', () => {
    expect(formatSmokeFailure(new DOMException('aborted', 'AbortError'))).toBe(
      'O teste real excedeu o tempo limite.',
    );
  });

  it('B17: maps incomplete evidence to the evidence message', () => {
    expect(formatSmokeFailure({ code: 'incomplete-evidence' })).toBe(INCOMPLETE_MESSAGE);
  });

  it('B17: falls back to a safe generic message for unknown errors', () => {
    const message = formatSmokeFailure(new Error('sentinel-secret'));

    expect(message).toBe(
      'Não foi possível concluir o teste real. Verifique a conexão e a configuração local.',
    );
    expect(message).not.toContain('sentinel-secret');
  });
});
