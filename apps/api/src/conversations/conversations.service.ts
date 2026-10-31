import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ConversationView, MessageView, UserView } from '@nexo/contracts';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class ConversationsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  private employee(user: UserView): void { if (user.role !== 'employee') throw new ForbiddenException(); }
  async list(user: UserView): Promise<ConversationView[]> {
    this.employee(user);
    const rows = await this.database.client.conversation.findMany({ where: { ownerId: user.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(({ id, createdAt }) => ({ id, createdAt: createdAt.toISOString() }));
  }
  async create(user: UserView): Promise<ConversationView> {
    this.employee(user);
    const row = await this.database.client.conversation.create({ data: { ownerId: user.id } });
    return { id: row.id, createdAt: row.createdAt.toISOString() };
  }
  private async owned(user: UserView, conversationId: string): Promise<void> {
    this.employee(user);
    if (!await this.database.client.conversation.findFirst({ where: { id: conversationId, ownerId: user.id }, select: { id: true } })) throw new NotFoundException();
  }
  async messages(user: UserView, conversationId: string): Promise<MessageView[]> {
    await this.owned(user, conversationId);
    const rows = await this.database.client.message.findMany({ where: { conversationId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(({ id, content, createdAt }) => ({ id, content, createdAt: createdAt.toISOString() }));
  }
  async append(user: UserView, conversationId: string, content: string): Promise<MessageView> {
    await this.owned(user, conversationId);
    const { id, createdAt } = await this.database.client.message.create({ data: { conversationId, content } });
    return { id, content, createdAt: createdAt.toISOString() };
  }
}
