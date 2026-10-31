import { createGoogle } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';

import type { ModelConfiguration } from './model-config.js';
import { IncompleteSmokeEvidenceError } from './smoke-runner.js';
import type { SmokeEvent, SmokeTransport, SmokeUsage } from './smoke-runner.js';
import { createSmokeTool, EchoOutputSchema } from './smoke-tool.js';

const INSTRUCTIONS = [
  'Você é o verificador da fundação técnica do Nexo Assist.',
  'Sempre chame a ferramenta foundation-echo exatamente uma vez com o nonce informado pelo usuário.',
  'Depois responda em português, em uma frase curta, incluindo o nonce devolvido pela ferramenta.',
  'Nunca invente um nonce nem afirme sucesso sem o resultado real da ferramenta.',
].join('\n');

export function assertSuccessfulFinish(reason: string): void {
  if (reason !== 'stop') {
    throw new IncompleteSmokeEvidenceError();
  }
}

function readUsage(value: unknown): SmokeUsage | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const usage: SmokeUsage = {};
  let hasMetric = false;

  for (const key of ['inputTokens', 'outputTokens', 'totalTokens'] as const) {
    const metric = record[key];

    if (typeof metric === 'number' && Number.isFinite(metric)) {
      usage[key] = metric;
      hasMetric = true;
    }
  }

  return hasMetric ? usage : undefined;
}

export function createMastraSmokeTransport(
  configuration: ModelConfiguration,
): SmokeTransport {
  const executedNonces: string[] = [];
  const tool = createSmokeTool((input) => {
    executedNonces.push(input.nonce);
  });
  const provider = createGoogle({ apiKey: configuration.apiKey });
  const agent = new Agent({
    id: 'foundation-smoke',
    name: 'Nexo Assist foundation smoke',
    instructions: INSTRUCTIONS,
    model: provider(configuration.model),
    tools: { 'foundation-echo': tool },
    maxRetries: 0,
  });

  return {
    async *run(nonce, signal): AsyncIterable<SmokeEvent> {
      const executionStart = executedNonces.length;
      const output = await agent.stream(
        `Chame a ferramenta foundation-echo com o nonce ${nonce} e responda brevemente em português incluindo o nonce devolvido.`,
        { maxSteps: 3, abortSignal: signal },
      );
      const reader = output.fullStream.getReader();

      try {
        for (;;) {
          const { done, value } = await reader.read();

          if (done) {
            return;
          }

          switch (value.type) {
            case 'tool-result': {
              const { payload } = value;

              if (payload.toolName !== 'foundation-echo' || payload.preliminary === true) {
                break;
              }

              const parsed = EchoOutputSchema.safeParse(payload.result);
              const observed = executedNonces.slice(executionStart).includes(nonce);

              if (parsed.success && parsed.data.nonce === nonce && observed) {
                yield {
                  type: 'tool-result',
                  nonce: parsed.data.nonce,
                  source: parsed.data.source,
                };
              }

              break;
            }

            case 'text-delta': {
              if (value.payload.text.length > 0) {
                yield { type: 'text-delta', text: value.payload.text };
              }

              break;
            }

            case 'tool-error': {
              throw value.payload.error;
            }

            case 'error': {
              throw value.payload.error;
            }

            case 'abort': {
              throw new DOMException('The model stream was aborted.', 'AbortError');
            }

            case 'finish': {
              assertSuccessfulFinish(value.payload.stepResult.reason);
              const usage = readUsage(value.payload.output.usage);

              yield { type: 'finish', ...(usage === undefined ? {} : { usage }) };
              break;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}
