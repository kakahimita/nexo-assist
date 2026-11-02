import { TicketEventViewSchema, TicketViewSchema, type TicketEventView, type TicketView, type UserView } from '@nexo/contracts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { Ticket } from '../generated/prisma/client.js';
import { deadline, isOverdue, type Priority } from './rules.js';
import { assertEmployee, TicketService } from './ticket-service.js';

@Injectable()
export class PrismaTicketService extends TicketService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { super(); }

  private view(ticket: Ticket, now: Date): TicketView {
    const due = deadline(ticket.slaStartedAt, ticket.priority as Priority);
    return TicketViewSchema.parse({ id: ticket.id, ownerId: ticket.ownerId, title: ticket.title, description: ticket.description, type: ticket.type, category: ticket.category, priority: ticket.priority, impact: ticket.impact, status: ticket.status, transferRequested: ticket.transferRequested, createdAt: ticket.createdAt.toISOString(), resolvedAt: ticket.resolvedAt?.toISOString() ?? null, slaStartedAt: ticket.slaStartedAt.toISOString(), deadline: due.toISOString(), overdue: ticket.status === 'open' && isOverdue(due, now) });
  }

  async list(user: UserView, now: Date): Promise<TicketView[]> {
    assertEmployee(user);
    const rows = await this.database.client.ticket.findMany({ where: { ownerId: user.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map((row) => this.view(row, now));
  }

  async get(user: UserView, id: string, now: Date): Promise<TicketView> {
    assertEmployee(user);
    const row = await this.database.client.ticket.findFirst({ where: { id, ownerId: user.id } });
    if (!row) throw new NotFoundException();
    return this.view(row, now);
  }

  async history(user: UserView, id: string): Promise<TicketEventView[]> {
    await this.get(user, id, new Date());
    const events = await this.database.client.ticketEvent.findMany({ where: { ticketId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return events.map((event) => TicketEventViewSchema.parse({ ...event, createdAt: event.createdAt.toISOString() }));
  }
}
