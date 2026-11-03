import { NextResponse } from 'next/server';
async function forward(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const route = path.join('/');
  const existing = /^(session|conversations|conversations\/[a-z0-9]+\/messages)$/.test(route);
  const consultationStream =
    request.method === 'POST' && /^conversations\/[a-z0-9]+\/messages\/stream$/.test(route);
  const handoff = request.method === 'POST' && /^conversations\/[a-z0-9]+\/handoff$/.test(route);
  const draftRecovery =
    request.method === 'GET' && /^conversations\/[a-z0-9]+\/draft-proposals$/.test(route);
  const ticketRead =
    request.method === 'GET' &&
    /^(tickets|tickets\/[a-z0-9-]+(?:\/history)?|ticket-drafts\/[a-z0-9-]+)$/.test(route);
  const ticketWrite =
    request.method === 'POST' &&
    /^(ticket-drafts|ticket-drafts\/[a-z0-9-]+\/(?:edit|cancel|confirm))$/.test(route);
  if (!existing && !ticketRead && !ticketWrite && !consultationStream && !handoff && !draftRecovery)
    return new Response(null, { status: 404 });
  if (request.method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001/api';
  try {
    const headers = new Headers();
    const cookie = request.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);
    if (request.method !== 'GET') headers.set('origin', new URL(request.url).origin);
    if (request.method === 'POST') headers.set('content-type', 'application/json');
    const response = await fetch(`${base.replace(/\/$/, '')}/${route}`, {
      method: request.method,
      headers,
      ...(request.method === 'POST' ? { body: await request.text() } : {}),
      cache: 'no-store',
      redirect: 'manual',
      signal: request.signal,
    });
    const resultHeaders = new Headers();
    for (const name of ['content-type', 'set-cookie', 'cache-control', 'x-accel-buffering']) {
      const value = response.headers.get(name);
      if (value) resultHeaders.set(name, value);
    }
    const body =
      response.status === 204
        ? null
        : response.headers.get('content-type')?.startsWith('text/event-stream')
          ? response.body
          : await response.arrayBuffer();
    return new Response(body, { status: response.status, headers: resultHeaders });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
export const GET = forward;
export const POST = forward;
export const DELETE = forward;
