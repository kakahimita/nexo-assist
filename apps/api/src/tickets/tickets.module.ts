import { Module } from '@nestjs/common';
import { DraftsService } from './drafts.service.js';
import { FailureSimulator } from './failure-simulator.js';
import { PrismaTicketService } from './prisma-ticket-service.js';
import { TicketService } from './ticket-service.js';
import { TicketsController } from './tickets.controller.js';

@Module({ controllers: [TicketsController], providers: [DraftsService, FailureSimulator, { provide: TicketService, useClass: PrismaTicketService }] })
export class TicketsModule {}
