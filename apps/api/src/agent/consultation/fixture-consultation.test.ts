import { describe, expect, it } from 'vitest';
import type { ConsultationTools } from '../tools/consultation-tools.js';
import { createFixtureConsultation } from './fixture-consultation.js';
import type { ConsultationEngineEvent } from './types.js';

describe('fixture consultation routing', () => {
  it('clarifies a generic VPN problem without consulting tickets', async () => {
    const engine = createFixtureConsultation({
      consultTickets: async () => {
        throw new Error('Ticket consultation must require an explicit request.');
      },
    } as unknown as ConsultationTools);
    const events: ConsultationEngineEvent[] = [];

    for await (const event of engine.run({
      user: { id: 'ana', email: 'ana.souza@nexo.com.br', name: 'Ana Souza', role: 'employee' },
      messages: [{ role: 'employee', content: 'Olá, não consigo acessar a VPN.' }],
      signal: new AbortController().signal,
      now: new Date('2026-11-05T12:00:00.000Z'),
    }))
      events.push(event);

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'decision',
        decision: expect.objectContaining({
          intent: 'Falha de VPN',
          action: 'clarify',
          missingFacts: expect.arrayContaining(['versão do Windows']),
        }),
      }),
    );
  });
});
