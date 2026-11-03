import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';
import { DatabaseService } from '../src/database/database.service.js';
import { FailureSimulator } from '../src/tickets/failure-simulator.js';
import { PrismaTicketService } from '../src/tickets/prisma-ticket-service.js';
import { KnowledgeService } from '../src/knowledge/knowledge.service.js';
import { ConsultationTools } from '../src/agent/tools/consultation-tools.js';
import { DraftsService } from '../src/tickets/drafts.service.js';

describe('B03/B16: authorized read-only consultation', () => {
  it('limits candidates to the authenticated employee and classifies knowledge', async () => {
    const db = await createTestDatabase();
    const database = new DatabaseService(db.url);
    try {
      const row = await database.client.user.findUniqueOrThrow({ where: { email: 'ana.souza@nexo.com.br' } });
      const ana = { id: row.id, email: row.email, name: row.name, role: 'employee' as const };
      const ticketService = new PrismaTicketService(database, new FailureSimulator());
      const tools = new ConsultationTools(ticketService, new KnowledgeService(database), new DraftsService(database, ticketService), database);
      const app = await createApp({ host: '127.0.0.1', port: 3001, webOrigin: 'http://localhost:3000', databaseUrl: db.url });
      try { expect((await app.get(ConsultationTools).searchKnowledge(ana, { query: 'VPN erro 809', platform: 'Windows 11' })).matches.length).toBeGreaterThan(0); } finally { await app.close(); }
      const before = await Promise.all([database.client.ticket.count(), database.client.ticketDraft.count(), database.client.ticketEvent.count()]);
      const all = await tools.consultTickets(ana, {}, new Date());
      expect(all.match).toBe('multiple');
      expect(all.tickets).toHaveLength(2);
      expect(all.tickets.map((ticket) => ticket.id)).toEqual(expect.arrayContaining(['fixture-ana-open', 'fixture-ana-resolved']));
      expect(all.tickets.map((ticket) => ticket.id)).not.toContain('fixture-bruno-open');
      expect(await tools.consultTickets(ana, { query: 'status' }, new Date())).toMatchObject({ match: 'multiple', tickets: all.tickets });
      expect(await tools.consultTickets(ana, { query: 'Qual o status do meu chamado?', kind: 'topic' }, new Date())).toMatchObject({ match: 'multiple', tickets: all.tickets });
      expect(await tools.consultTickets(ana, { query: 'Meus chamados' }, new Date())).toMatchObject({ match: 'multiple', tickets: all.tickets });
      expect(await tools.consultTickets(ana, { query: 'INC-99999' }, new Date())).toMatchObject({ match: 'unknown_reference', tickets: all.tickets });
      expect(await tools.consultTickets(ana, { query: 'INC-99999', kind: 'topic' }, new Date())).toMatchObject({ match: 'unknown_reference', tickets: all.tickets });
      expect(await tools.consultTickets(ana, { query: 'fixture-bruno-open', kind: 'reference' }, new Date())).toMatchObject({ match: 'unknown_reference', tickets: all.tickets });
      expect((await tools.consultTickets(ana, { query: 'Notebook lento', kind: 'topic' }, new Date())).tickets.map((ticket) => ticket.id)).toEqual(['fixture-ana-open']);
      expect(await tools.consultTickets(ana, { query: 'INC-99999', kind: 'reference' }, new Date())).toMatchObject({ match: 'unknown_reference', tickets: all.tickets });
      expect(await tools.consultTickets(ana, { query: 'VPN', kind: 'topic' }, new Date())).toMatchObject({ match: 'none', tickets: [] });
      await expect(tools.consultTickets({ ...ana, role: 'analyst' }, {}, new Date())).rejects.toMatchObject({ status: 403 });
      await expect(tools.consultTickets(undefined as never, {}, new Date())).rejects.toMatchObject({ status: 401 });
      await expect(tools.searchKnowledge(ana, { query: 'vpn', ownerId: 'other' })).rejects.toThrow();
      expect((await tools.searchKnowledge(ana, { query: 'VPN erro 809' })).matches.filter((item) => item.platform !== 'any').every((item) => item.applicability === 'platform_unknown')).toBe(true);
      for (const [platform, id] of [['Windows 10', 'kb-vpn-809-windows-10'], ['Windows 11', 'kb-vpn-809-windows-11']] as const) {
        const result = await tools.searchKnowledge(ana, { query: 'VPN erro 809', platform });
        expect(result.matches.find((item) => item.id === id)?.applicability).toBe('applicable');
        expect(result.matches.filter((item) => item.id !== id).every((item) => item.applicability !== 'applicable')).toBe(true);
      }
      expect((await tools.searchKnowledge(ana, { query: 'férias no RH' })).matches).toEqual([]);
      expect(await Promise.all([database.client.ticket.count(), database.client.ticketDraft.count(), database.client.ticketEvent.count()])).toEqual(before);
    } finally { await database.onModuleDestroy(); await db.cleanup(); }
  });
});
