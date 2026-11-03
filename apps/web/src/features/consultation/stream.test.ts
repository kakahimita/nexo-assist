import { describe, expect, it } from 'vitest';
import { readConsultationStream } from './stream.js';
const bytes = new TextEncoder();
function stream(...chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(bytes.encode(chunk));
      controller.close();
    },
  });
}
describe('SSE consultation parser', () => {
  it('handles split events, multiple events and keep-alives', async () => {
    const events: unknown[] = [];
    await readConsultationStream(
      stream(
        ': ping\n\ndata: {"type":"text-',
        'delta","text":"Olá"}\n\ndata: {"type":"error","code":"quota"}\n\n',
      ),
      (event) => events.push(event),
    );
    expect(events).toEqual([
      { type: 'text-delta', text: 'Olá' },
      { type: 'error', code: 'quota' },
    ]);
  });
  it('rejects malformed or incomplete event data without inventing an event', async () => {
    const events: unknown[] = [];
    await expect(
      readConsultationStream(stream('data: {bad}\n\n'), (event) => events.push(event)),
    ).rejects.toThrow();
    await expect(
      readConsultationStream(stream('data: {"type":'), (event) => events.push(event)),
    ).rejects.toThrow();
    expect(events).toEqual([]);
  });
});
