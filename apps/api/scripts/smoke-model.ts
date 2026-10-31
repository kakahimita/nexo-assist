import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { config as loadEnvironment } from 'dotenv';

import { parseModelEnvironment } from '../src/agent/model-config.js';
import type { ModelConfiguration } from '../src/agent/model-config.js';
import { createMastraSmokeTransport } from '../src/agent/mastra-smoke.js';
import { formatSmokeFailure, runSmoke } from '../src/agent/smoke-runner.js';
import type { SmokeEvidence } from '../src/agent/smoke-runner.js';
import { REPOSITORY_ROOT } from '../src/config/paths.js';

const TIMEOUT_MS = 60_000;
const MISSING_KEY_MESSAGE =
  'Configure GOOGLE_API_KEY localmente para executar o teste real.';
const GENERIC_MESSAGE =
  'Não foi possível concluir o teste real. Verifique a conexão e a configuração local.';

function printConfigurationFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('GOOGLE_API_KEY')) {
    console.error(MISSING_KEY_MESSAGE);
    return;
  }

  if (message.includes('MODEL_PROVIDER') || message.includes('MODEL_NAME')) {
    console.error(message);
    return;
  }

  console.error(GENERIC_MESSAGE);
}

function printSummary(evidence: SmokeEvidence): void {
  console.log('');
  console.log('Resumo sanitizado do teste real:');
  console.log(`- Provedor: ${evidence.provider}`);
  console.log(`- Modelo: ${evidence.model}`);
  console.log(`- Prompt: ${evidence.promptVersion}`);
  console.log(`- Nonce: ${evidence.nonce}`);
  console.log(`- Execuções da ferramenta: ${evidence.toolExecutions}`);
  console.log(`- Blocos de texto: ${evidence.textChunks}`);
  console.log(`- Duração: ${evidence.durationMs} ms`);

  if (evidence.usage !== undefined) {
    console.log(
      `- Uso: entrada=${evidence.usage.inputTokens ?? 'n/d'}, ` +
        `saída=${evidence.usage.outputTokens ?? 'n/d'}, ` +
        `total=${evidence.usage.totalTokens ?? 'n/d'}`,
    );
  }
}

async function main(): Promise<void> {
  loadEnvironment({ path: resolve(REPOSITORY_ROOT, '.env'), override: false, quiet: true });

  let configuration: ModelConfiguration;

  try {
    configuration = parseModelEnvironment(process.env);
  } catch (error) {
    printConfigurationFailure(error);
    process.exitCode = 1;
    return;
  }

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const nonce = randomUUID();

  try {
    const transport = createMastraSmokeTransport(configuration);
    const evidence = await runSmoke(transport, {
      provider: configuration.provider,
      model: configuration.model,
      nonce,
      signal: controller.signal,
      onText: (chunk) => process.stdout.write(chunk),
    });

    printSummary(evidence);
  } catch (error) {
    console.log('');
    console.error(formatSmokeFailure(error));
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
  }
}

await main();
