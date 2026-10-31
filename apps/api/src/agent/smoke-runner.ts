import { EchoOutputSchema } from './smoke-tool.js';

export interface SmokeUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export type SmokeEvent =
  | { type: 'tool-result'; nonce: string; source: 'foundation-smoke' }
  | { type: 'text-delta'; text: string }
  | { type: 'finish'; usage?: SmokeUsage };

export interface SmokeTransport {
  run(nonce: string, signal: AbortSignal): AsyncIterable<SmokeEvent>;
}

export interface SmokeEvidence {
  provider: string;
  model: string;
  promptVersion: 'foundation-v1';
  nonce: string;
  toolExecutions: number;
  textChunks: number;
  text: string;
  durationMs: number;
  usage?: SmokeUsage;
}

export interface SmokeRunOptions {
  provider: string;
  model: string;
  nonce: string;
  signal: AbortSignal;
  onText: (chunk: string) => void;
}

const INCOMPLETE_EVIDENCE_MESSAGE =
  'O teste não comprovou a execução da ferramenta e o streaming.';
const TIMEOUT_MESSAGE = 'O teste real excedeu o tempo limite.';
const GENERIC_MESSAGE =
  'Não foi possível concluir o teste real. Verifique a conexão e a configuração local.';

export class IncompleteSmokeEvidenceError extends Error {
  readonly code = 'incomplete-evidence' as const;

  constructor() {
    super(INCOMPLETE_EVIDENCE_MESSAGE);
    this.name = 'IncompleteSmokeEvidenceError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function createAbortError(): DOMException {
  return new DOMException('The model smoke run was aborted.', 'AbortError');
}

function toUsage(value: unknown): SmokeUsage | undefined {
  const record = asRecord(value);

  if (record === undefined) {
    return undefined;
  }

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

export async function runSmoke(
  transport: SmokeTransport,
  options: SmokeRunOptions,
): Promise<SmokeEvidence> {
  const startedAt = performance.now();
  const textChunks: string[] = [];
  let toolExecutions = 0;
  let finished = false;
  let usage: SmokeUsage | undefined;

  for await (const event of transport.run(options.nonce, options.signal)) {
    if (options.signal.aborted) {
      throw createAbortError();
    }

    switch (event.type) {
      case 'tool-result': {
        const parsed = EchoOutputSchema.safeParse({ nonce: event.nonce, source: event.source });

        if (parsed.success && parsed.data.nonce === options.nonce) {
          toolExecutions += 1;
        }

        break;
      }

      case 'text-delta': {
        if (event.text.length > 0) {
          textChunks.push(event.text);
          options.onText(event.text);
        }

        break;
      }

      case 'finish': {
        finished = true;
        usage = toUsage(event.usage);
        break;
      }
    }
  }

  if (options.signal.aborted) {
    throw createAbortError();
  }

  const text = textChunks.join('');
  const hasEvidence =
    toolExecutions > 0 && finished && textChunks.length > 0 && text.includes(options.nonce);

  if (!hasEvidence) {
    throw new IncompleteSmokeEvidenceError();
  }

  return {
    provider: options.provider,
    model: options.model,
    promptVersion: 'foundation-v1',
    nonce: options.nonce,
    toolExecutions,
    textChunks: textChunks.length,
    text,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    ...(usage === undefined ? {} : { usage }),
  };
}

function findStatusCode(error: unknown, depth = 0): number | undefined {
  const record = asRecord(error);

  if (record === undefined || depth > 3) {
    return undefined;
  }

  for (const candidate of [
    record.statusCode,
    record.status,
    asRecord(record.response)?.status,
  ]) {
    if (typeof candidate === 'number') {
      return candidate;
    }
  }

  return findStatusCode(record.cause, depth + 1) ?? findStatusCode(record.error, depth + 1);
}

function hasErrorCode(error: unknown, code: string, depth = 0): boolean {
  const record = asRecord(error);

  if (record === undefined || depth > 3) {
    return false;
  }

  if (record.code === code) {
    return true;
  }

  return (
    hasErrorCode(record.cause, code, depth + 1) || hasErrorCode(record.error, code, depth + 1)
  );
}

function isAbortError(error: unknown, depth = 0): boolean {
  const record = asRecord(error);

  if (record === undefined || depth > 3) {
    return false;
  }

  if (record.name === 'AbortError' || record.code === 'ABORT_ERR' || record.code === 20) {
    return true;
  }

  return isAbortError(record.cause, depth + 1) || isAbortError(record.error, depth + 1);
}

export function formatSmokeFailure(error: unknown): string {
  if (hasErrorCode(error, 'incomplete-evidence')) {
    return INCOMPLETE_EVIDENCE_MESSAGE;
  }

  if (isAbortError(error)) {
    return TIMEOUT_MESSAGE;
  }

  const statusCode = findStatusCode(error);

  if (statusCode === 401 || statusCode === 403) {
    return 'Acesso ao provedor recusado. Verifique a chave e as permissões locais.';
  }

  if (statusCode === 404) {
    return 'Modelo indisponível. Verifique MODEL_NAME e o acesso da conta.';
  }

  if (statusCode === 429) {
    return 'Cota do provedor esgotada. Aguarde a renovação ou verifique os limites da conta.';
  }

  return GENERIC_MESSAGE;
}
