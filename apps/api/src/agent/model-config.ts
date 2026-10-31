export interface ModelConfiguration {
  provider: 'google';
  model: string;
  apiKey: string;
}

const DEFAULTS = {
  provider: 'google',
  model: 'gemini-3.5-flash-lite',
} as const;

function readVariable(input: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = input[name];

  if (value === undefined) {
    return undefined;
  }

  if (value.trim() === '') {
    throw new Error(`${name} must not be blank.`);
  }

  return value.trim();
}

export function parseModelEnvironment(input: NodeJS.ProcessEnv): ModelConfiguration {
  const provider = readVariable(input, 'MODEL_PROVIDER') ?? DEFAULTS.provider;

  if (provider !== 'google') {
    throw new Error('MODEL_PROVIDER must be google.');
  }

  const model = readVariable(input, 'MODEL_NAME') ?? DEFAULTS.model;
  const apiKey = readVariable(input, 'GOOGLE_API_KEY');

  if (apiKey === undefined) {
    throw new Error('GOOGLE_API_KEY must be set locally to run the real model smoke test.');
  }

  return { provider, model, apiKey };
}
