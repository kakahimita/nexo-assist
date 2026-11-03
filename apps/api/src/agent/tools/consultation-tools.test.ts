import { describe, expect, it, vi } from 'vitest';
import { createConsultationTools } from './mastra-consultation-tools.js';
import { createConsultationRequestContext } from '../consultation/request-context.js';
import type { ConsultationTools } from './consultation-tools.js';

const user = { id: 'ana', email: 'ana@example.com', name: 'Ana', role: 'employee' as const };
describe('B16: tool inputs cannot forge identity', () => {
  it('does not send incompatible or unknown-platform article instructions to the model', () => {
    const tools = createConsultationTools({} as ConsultationTools);
    const result = {
      platform: 'windows11' as const,
      matches: [
        {
          id: 'wrong',
          title: 'Windows 10',
          summary: 'old',
          body: 'Reinstale',
          platform: 'windows10' as const,
          applicability: 'platform_mismatch' as const,
          reason: 'Versão diferente',
        },
        {
          id: 'unknown',
          title: 'Windows 10',
          summary: 'old',
          body: 'Reinstale',
          platform: 'windows10' as const,
          applicability: 'platform_unknown' as const,
          reason: 'Versão desconhecida',
        },
        {
          id: 'right',
          title: 'Windows 11',
          summary: 'ok',
          body: 'Abra chamado',
          platform: 'windows11' as const,
          applicability: 'applicable' as const,
          reason: 'Compatível',
        },
      ],
    };
    const projected = JSON.stringify(tools.searchKnowledge.toModelOutput!(result));
    expect(projected).not.toContain('Reinstale');
    expect(projected).toContain('Abra chamado');
  });
  it('rejects invalid arguments before invoking backing services', async () => {
    const consultTickets = vi.fn();
    const searchKnowledge = vi.fn();
    const tools = createConsultationTools({
      consultTickets,
      searchKnowledge,
    } as unknown as ConsultationTools);
    expect(tools.consultTickets.id).toBe('consult-tickets');
    expect(tools.searchKnowledge.id).toBe('search-knowledge');
    expect(tools.consultTickets.inputSchema).toBeDefined();
    expect(tools.consultTickets.outputSchema).toBeDefined();
    expect(tools.searchKnowledge.inputSchema).toBeDefined();
    expect(tools.searchKnowledge.outputSchema).toBeDefined();
    const context = { requestContext: createConsultationRequestContext(user, new Date()) };
    for (const input of [
      { ownerId: 'other' },
      { query: '' },
      { query: 'x'.repeat(401) },
      { kind: 'bad' },
    ]) {
      await expect(
        tools.consultTickets.execute!(input as never, context as never),
      ).resolves.toMatchObject({ error: true });
    }
    for (const input of [
      { query: 'vpn', employeeId: 'other' },
      { query: '' },
      { query: 'vpn', platform: 12 },
      { query: 'x'.repeat(401) },
      { query: 'vpn', platform: '' },
    ]) {
      await expect(
        tools.searchKnowledge.execute!(input as never, context as never),
      ).resolves.toMatchObject({ error: true });
    }
    await expect(tools.consultTickets.execute!({} as never, {} as never)).rejects.toThrow();
    await expect(
      tools.searchKnowledge.execute!({ query: 'vpn' } as never, {} as never),
    ).rejects.toThrow();
    expect(consultTickets).not.toHaveBeenCalled();
    expect(searchKnowledge).not.toHaveBeenCalled();
  });
});
