import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { UserViewSchema } from '@nexo/contracts';
import { createApp } from '../src/app.js';
import { createTestDatabase } from './support/test-database.js';
import { createDatabaseClient } from '../src/database/client.js';
import { ConsultationTools } from '../src/agent/tools/consultation-tools.js';
import { ConversationsService } from '../src/conversations/conversations.service.js';
import { DraftsService } from '../src/tickets/drafts.service.js';

it('accepts evidenced semantic facts without requiring standardized answers and rejects ungrounded sources', async () => {
  const db = await createTestDatabase();
  const client = createDatabaseClient(db.url);
  const app = await createApp({
    host: '127.0.0.1',
    port: 3001,
    webOrigin: 'http://localhost:3000',
    databaseUrl: db.url,
  });
  try {
    const user = UserViewSchema.parse(
      await client.user.findUniqueOrThrow({ where: { email: 'bruno.lima@nexo.com.br' } }),
    );
    const conversations = app.get(ConversationsService);
    const tools = app.get(ConsultationTools);
    const conversation = await conversations.create(user);
    const old = await conversations.append(
      user,
      conversation.id,
      'O problema anterior parou minha equipe inteira e temos entrega hoje.',
    );
    const problem = await conversations.append(
      user,
      conversation.id,
      'Agora meu projetor apagou durante o uso.',
    );
    const detail = await conversations.append(
      user,
      conversation.id,
      'Já troquei o cabo, mas continuou apagado. Só acontece comigo; consigo usar a outra sala e não há nenhuma entrega ou reunião em risco hoje.',
    );
    const evidence = (value: string, quote: string, messageId = detail.id) => ({
      value,
      evidence: { messageId, quote },
    });
    const input = {
      action: 'create',
      title: problem.content,
      description: `${problem.content}\n${detail.content}`,
      requiresAnalyst: true,
      interpretation: {
        requestStartMessageId: problem.id,
        type: evidence('INC', problem.content, problem.id),
        category: evidence('hardware', problem.content, problem.id),
        impact: evidence('self', 'Só acontece comigo'),
        workState: evidence('workaround', 'consigo usar a outra sala'),
        urgency: evidence('normal', 'não há nenhuma entrega ou reunião em risco hoje'),
      },
    };
    const context = { conversationId: conversation.id, runId: randomUUID(), now: new Date() };
    const ticketsBefore = await client.ticket.count();
    const result = await tools.proposeDraft(user, input, context);
    expect(result.status).toBe('draft');
    if (result.status !== 'draft') throw new Error('Expected draft');
    const draft = await app.get(DraftsService).get(user, result.draftId);
    expect(draft.priority).toBe('medium');
    expect(draft.input).toMatchObject({
      category: 'hardware',
      type: 'INC',
      impact: 'self',
      workState: 'workaround',
      urgency: 'normal',
    });
    expect(await client.ticket.count()).toBe(ticketsBefore);
    const invalid = [
      { ...input.interpretation, impact: evidence('team', old.content, old.id) },
      { ...input.interpretation, impact: evidence('self', 'Sou o único', detail.id) },
      { ...input.interpretation, impact: evidence('self', detail.content, 'foreign') },
      { ...input.interpretation, impact: evidence('unknown', detail.content) },
      { ...input.interpretation, requestStartMessageId: 'foreign' },
    ];
    const agent = await client.message.create({
      data: { conversationId: conversation.id, role: 'agent', content: 'Só acontece comigo' },
    });
    invalid.push({ ...input.interpretation, impact: evidence('self', agent.content, agent.id) });
    const other = UserViewSchema.parse(
      await client.user.findUniqueOrThrow({ where: { email: 'ana.souza@nexo.com.br' } }),
    );
    const foreignConversation = await conversations.create(other);
    const foreign = await conversations.append(other, foreignConversation.id, 'Só acontece comigo');
    invalid.push({
      ...input.interpretation,
      impact: evidence('self', foreign.content, foreign.id),
    });
    for (const interpretation of invalid)
      await expect(
        tools.proposeDraft(user, { ...input, interpretation }, { ...context, runId: randomUUID() }),
      ).rejects.toThrow();
    expect(await client.ticket.count()).toBe(ticketsBefore);
  } finally {
    await app.close();
    await client.$disconnect();
    await db.cleanup();
  }
});
