import { describe, expect, it } from 'vitest';

import { parseModelEnvironment } from './model-config.js';

const VALID_KEY = 'local-test-key';
const SENTINEL_KEY = 'sentinel-secret-value';

function captureError(run: () => void): Error {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }

    throw new Error('Expected an Error instance.');
  }

  throw new Error('Expected the parser to reject the input.');
}

describe('parseModelEnvironment', () => {
  it('B17: defaults provider and model and reads an explicit key', () => {
    expect(parseModelEnvironment({ GOOGLE_API_KEY: VALID_KEY })).toEqual({
      provider: 'google',
      model: 'gemini-3.5-flash-lite',
      apiKey: VALID_KEY,
    });
  });

  it('B17: accepts an explicit provider and model', () => {
    expect(
      parseModelEnvironment({
        MODEL_PROVIDER: 'google',
        MODEL_NAME: 'gemini-3.5-flash',
        GOOGLE_API_KEY: VALID_KEY,
      }),
    ).toEqual({ provider: 'google', model: 'gemini-3.5-flash', apiKey: VALID_KEY });
  });

  it('B17: rejects a missing key by naming the variable', () => {
    const error = captureError(() => parseModelEnvironment({}));

    expect(error.message).toContain('GOOGLE_API_KEY');
  });

  it.each(['GOOGLE_API_KEY', 'MODEL_NAME'])(
    'B17: rejects a blank %s without leaking the key',
    (variable) => {
      const input: NodeJS.ProcessEnv = {
        GOOGLE_API_KEY: SENTINEL_KEY,
        MODEL_NAME: 'gemini-3.5-flash-lite',
        [variable]: '   ',
      };
      const error = captureError(() => parseModelEnvironment(input));

      expect(error.message).toContain(variable);
      expect(error.message).not.toContain(SENTINEL_KEY);
      expect(JSON.stringify(error)).not.toContain(SENTINEL_KEY);
    },
  );

  it('B17: rejects unsupported providers without exposing the key', () => {
    const error = captureError(() =>
      parseModelEnvironment({ MODEL_PROVIDER: 'openai', GOOGLE_API_KEY: SENTINEL_KEY }),
    );

    expect(error.message).toContain('MODEL_PROVIDER');
    expect(error.message).not.toContain(SENTINEL_KEY);
    expect(error.message).not.toContain('openai');
  });
});
