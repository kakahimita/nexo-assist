import { HealthResponseSchema } from '@nexo/contracts';
import type { HealthResponse } from '@nexo/contracts';

export type ApiHealthErrorCode = 'network' | 'http' | 'invalid-response';

const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';

export class ApiHealthError extends Error {
  readonly code: ApiHealthErrorCode;

  constructor(code: ApiHealthErrorCode) {
    super(code);
    this.name = 'ApiHealthError';
    this.code = code;
  }
}

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export async function fetchApiHealth(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<HealthResponse> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(normalizedBaseUrl)) {
    throw new ApiHealthError('network');
  }

  let response: Response;

  try {
    response = await fetch(`${normalizedBaseUrl}/health`, signal === undefined ? {} : { signal });
  } catch {
    throw new ApiHealthError('network');
  }

  if (!response.ok) {
    throw new ApiHealthError('http');
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new ApiHealthError('invalid-response');
  }

  const result = HealthResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new ApiHealthError('invalid-response');
  }

  return result.data;
}
