import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../../test/support/test-database.js';
import { DatabaseService } from '../../database/database.service.js';
import { FailureSimulator } from '../../tickets/failure-simulator.js';
import { PrismaTicketService } from '../../tickets/prisma-ticket-service.js';
import { KnowledgeService } from '../../knowledge/knowledge.service.js';
import { ConsultationTools } from '../tools/consultation-tools.js';
import { createFixtureConsultation } from './fixture-consultation.js';
import { ConsultationTurn } from './turn.js';

describe('B02/B03/B16: deterministic consultation', () => {
  it('clarifies platform, selects owned tickets and redirects out-of-scope questions without writes', async () => {
    const db = await createTestDatabase(); const database = new DatabaseService(db.url);
    try {
      const row = await database.client.user.findUniqueOrThrow({ where: { email: 'ana.souza@nexo.com.br' } });
      const user = { id: row.id, email: row.email, name: row.name, role: 'employee' as const };
      const engine = createFixtureConsultation(new ConsultationTools(new PrismaTicketService(database, new FailureSimulator()), new KnowledgeService(database)));
      const before = [await database.client.ticket.count(), await database.client.ticketDraft.count()];
      async function run(content: string) {
        const turn = new ConsultationTurn();
        for await (const event of engine.run({ user, messages: [{ role: 'employee', content }], signal: new AbortController().signal, now: new Date() })) turn.apply(event);
        return turn.snapshot();
      }
      const question = 'Meu notebook não conecta na VPN e mostra o erro 809';
      const unknown = await run(question);
      expect(unknown.decision.missingFacts).toContain('versão do Windows');
      expect(unknown.evidence).toEqual([]); expect(unknown.actions).toHaveLength(2);
      const win11 = await run(`${question} Windows 11`);
      expect(win11.evidence).toContainEqual(expect.objectContaining({ id: 'kb-vpn-809-windows-11' }));
      expect(win11.evidence).not.toContainEqual(expect.objectContaining({ id: 'kb-vpn-809-windows-10' }));
      expect(win11.text).not.toMatch(/reinstale o cliente vpn/i);
      const win10 = await run(`${question} Windows 10`);
      expect(win10.evidence).toContainEqual(expect.objectContaining({ id: 'kb-vpn-809-windows-10' }));
      const list = await run('Qual o status do meu chamado?');
      expect(list.decision.action).toBe('clarify'); expect(list.tickets).toHaveLength(2);
      expect((await run('INC-99999')).decision.action).toBe('clarify');
      const topic = await run('Qual o status do Notebook lento?');
      expect(topic.text).toContain('Notebook lento'); expect(topic.text).toContain(topic.tickets[0]!.deadline);
      const corrected = new ConsultationTurn();
      for await (const event of engine.run({ user, messages: [{ role: 'employee', content: `${question} Windows 11` }, { role: 'agent', content: 'Entendi Windows 11.' }, { role: 'employee', content: 'Windows 10' }], signal: new AbortController().signal, now: new Date() })) corrected.apply(event);
      expect(corrected.snapshot().evidence).toContainEqual(expect.objectContaining({ id: 'kb-vpn-809-windows-10' }));
      expect(corrected.snapshot().evidence).not.toContainEqual(expect.objectContaining({ id: 'kb-vpn-809-windows-11' }));
      const continued = new ConsultationTurn();
      for await (const event of engine.run({ user, messages: [{ role: 'employee', content: question }, { role: 'agent', content: 'Qual versão do Windows?' }, { role: 'employee', content: 'Qual o status do meu chamado?' }], signal: new AbortController().signal, now: new Date() })) continued.apply(event);
      expect(continued.snapshot().decision.intent).toBe('Consulta de chamado');
      expect(continued.snapshot().tickets).toHaveLength(2);
      const outside = await run('Como solicitar férias no RH?');
      expect(outside.decision.action).toBe('redirect'); expect(outside.actions).toEqual([]);
      expect([await database.client.ticket.count(), await database.client.ticketDraft.count()]).toEqual(before);
    } finally { await database.onModuleDestroy(); await db.cleanup(); }
  });
});
