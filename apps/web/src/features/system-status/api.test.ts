import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchApiHealth } from './api.js';

const baseUrl = 'http://localhost:3001/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('B17: browser health client', () => {
  it('B17: returns the exact contract for a valid payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ status: 'ok', service: 'nexo-api' })),
    );

    await expect(fetchApiHealth(baseUrl)).resolves.toEqual({ status: 'ok', service: 'nexo-api' });
  });

  it('B17: rejects a non-2xx response with code http', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'unavailable' }, 503)));

    await expect(fetchApiHealth(baseUrl)).rejects.toMatchObject({ code: 'http' });
  });

  it('B17: rejects a successful HTTP response with an invalid contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'ok', service: 'other' })));

    await expect(fetchApiHealth(baseUrl)).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('B17: rejects HTML or invalid JSON as invalid-response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    );

    await expect(fetchApiHealth(baseUrl)).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('B17: rejects extra credential fields as invalid-response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ status: 'ok', service: 'nexo-api', apiKey: 'sentinel-secret' }),
        ),
    );

    await expect(fetchApiHealth(baseUrl)).rejects.toMatchObject({ code: 'invalid-response' });
  });

  it('B17: rejects a failed fetch with code network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection failed')));

    await expect(fetchApiHealth(baseUrl)).rejects.toMatchObject({ code: 'network' });
  });

  it('B17: normalizes a trailing slash and forwards the abort signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok', service: 'nexo-api' }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await fetchApiHealth(`${baseUrl}/`, controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/health`,
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('B17: rejects a non-HTTP base URL without a network call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchApiHealth('file:///tmp/api')).rejects.toMatchObject({ code: 'network' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
