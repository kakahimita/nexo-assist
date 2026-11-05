import { describe, expect, it } from 'vitest';
import { DatabaseService } from '../src/database/database.service.js';
import { FailureSimulator } from '../src/tickets/failure-simulator.js';
import { PrismaTicketService } from '../src/tickets/prisma-ticket-service.js';
import { DraftsService } from '../src/tickets/drafts.service.js';
import { KnowledgeService } from '../src/knowledge/knowledge.service.js';
import { ConsultationTools } from '../src/agent/tools/consultation-tools.js';
import { createTestDatabase } from './support/test-database.js';

describe('B03: ticket numbers', () => {
  it('allocates sequential numbers per type and matches a formatted reference', async () => {
    const db = await createTestDatabase();
    const database = new DatabaseService(db.url);
    try {
      const row = await database.client.user.findUniqueOrThrow({
        where: { email: 'ana.souza@nexo.com.br' },
      });
      const ana = { id: row.id, email: row.email, name: row.name, role: 'employee' as const };
      const tickets = new PrismaTicketService(database, new FailureSimulator());
      const drafts = new DraftsService(database, tickets);
      const create = async (
        type: 'INC' | 'REQ',
        title: string,
        description: string,
        category: 'hardware' | 'network_vpn',
      ) => {
        const draft = await drafts.create(ana, {
          action: 'create',
          title,
          description,
          type,
          category,
          impact: 'self',
          workState: 'stopped',
          urgency: 'normal',
        });
        return tickets.confirm(
          ana,
          draft.id,
          { version: draft.version, operationId: draft.operationId },
          new Date(),
        );
      };

      const first = await create(
        'INC',
        'Impressora sem papel',
        'Preciso repor o rolo da impressora.',
        'hardware',
      );
      const second = await create(
        'INC',
        'VPN cai a cada hora',
        'A conexão remota encerra sozinha.',
        'network_vpn',
      );
      const request = await create(
        'REQ',
        'Monitor adicional',
        'Solicito um segundo monitor.',
        'hardware',
      );

      expect(first.number).toBe('INC-20312');
      expect(second.number).toBe('INC-20313');
      expect(request.number).toBe('REQ-10443');

      const tools = new ConsultationTools(
        tickets,
        new KnowledgeService(database),
        drafts,
        database,
      );
      expect(
        await tools.consultTickets(ana, { query: first.number!, kind: 'reference' }, new Date()),
      ).toMatchObject({ match: 'one', tickets: [{ id: first.id }] });
    } finally {
      await database.onModuleDestroy();
      await db.cleanup();
    }
  });
});
