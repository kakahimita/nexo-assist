import { ConsultationStreamEventSchema, type ConsultationStreamEvent } from '@nexo/contracts';
export async function readConsultationStream(body: ReadableStream<Uint8Array>, onEvent: (event: ConsultationStreamEvent) => void): Promise<void> {
  const reader = body.getReader(); const decoder = new TextDecoder(); let buffer = '';
  function consume(block: string): void {
    const lines = block.split(/\r?\n/).filter((line) => line.startsWith('data:'));
    if (!lines.length) return;
    const data = lines.map((line) => line.slice(5).replace(/^ /, '')).join('\n');
    onEvent(ConsultationStreamEventSchema.parse(JSON.parse(data) as unknown));
  }
  try {
    for (;;) {
      const chunk = await reader.read(); buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      for (;;) { const match = /\r?\n\r?\n/.exec(buffer); if (!match || match.index === undefined) break; consume(buffer.slice(0, match.index)); buffer = buffer.slice(match.index + match[0].length); }
      if (chunk.done) break;
    }
    if (buffer.trim()) throw new Error('Incomplete stream');
  } finally { reader.releaseLock(); }
}
