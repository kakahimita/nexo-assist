import { NextResponse } from 'next/server';
async function forward(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const route = path.join('/');
  if (!/^(session|conversations|conversations\/[a-z0-9]+\/messages)$/.test(route)) return new Response(null, { status: 404 });
  if (request.method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin) return new Response(null, { status: 403 });
  const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001/api';
  try {
    const headers = new Headers();
    const cookie = request.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);
    if (request.method !== 'GET') headers.set('origin', new URL(request.url).origin);
    if (request.method === 'POST') headers.set('content-type', 'application/json');
    const response = await fetch(`${base.replace(/\/$/, '')}/${route}`, { method: request.method, headers, ...(request.method === 'POST' ? { body: await request.text() } : {}), cache: 'no-store', redirect: 'manual' });
    const resultHeaders = new Headers();
    for (const name of ['content-type', 'set-cookie']) { const value = response.headers.get(name); if (value) resultHeaders.set(name, value); }
    return new Response(response.status === 204 ? null : await response.arrayBuffer(), { status: response.status, headers: resultHeaders });
  } catch { return NextResponse.json({ error: 'unavailable' }, { status: 503 }); }
}
export const GET = forward;
export const POST = forward;
export const DELETE = forward;
