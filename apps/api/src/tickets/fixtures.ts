import type { PrismaClient } from '../generated/prisma/client.js';
import { normalizeTitle } from './normalize-title.js';

const fixtures = [
  {
    id: 'fixture-ana-open',
    owner: 'ana.souza@nexo.com.br',
    title: 'Notebook lento',
    description: 'O notebook está lento depois da atualização.',
    type: 'INC',
    category: 'hardware',
    priority: 'medium',
    status: 'open',
  },
  {
    id: 'fixture-ana-resolved',
    owner: 'ana.souza@nexo.com.br',
    title: 'Senha bloqueada',
    description: 'A senha de acesso foi desbloqueada.',
    type: 'INC',
    category: 'access',
    priority: 'medium',
    status: 'resolved',
  },
  {
    id: 'fixture-bruno-open',
    owner: 'bruno.lima@nexo.com.br',
    title: 'Acesso à VPN',
    description: 'Preciso de acesso à VPN.',
    type: 'REQ',
    category: 'network_vpn',
    priority: 'low',
    status: 'open',
  },
] as const;

export async function initializeTicketFixtures(client: PrismaClient): Promise<void> {
  const now = new Date();
  for (const fixture of fixtures) {
    const owner = await client.user.findUniqueOrThrow({ where: { email: fixture.owner } });
    const createdAt =
      fixture.id === 'fixture-ana-open' ? new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) : now;
    await client.ticket.upsert({
      where: { id: fixture.id },
      update: {},
      create: {
        id: fixture.id,
        ownerId: owner.id,
        title: fixture.title,
        normalizedTitle: normalizeTitle(fixture.title),
        description: fixture.description,
        type: fixture.type,
        category: fixture.category,
        priority: fixture.priority,
        impact: 'self',
        status: fixture.status,
        resolvedAt: fixture.status === 'resolved' ? now : null,
        createdAt,
        slaStartedAt: createdAt,
        events: {
          create: {
            id: `${fixture.id}-created`,
            kind: 'created',
            content: 'Chamado de exemplo criado.',
            createdAt,
          },
        },
      },
    });
  }
}
