import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { DraftInputSchema } from '@nexo/contracts';
import { z } from 'zod';
import { IdentityGuard, type AuthRequest } from '../identity/identity.guard.js';
import { DraftsService } from './drafts.service.js';
import { TicketService } from './ticket-service.js';

@Controller()
@UseGuards(IdentityGuard)
export class TicketsController {
  constructor(@Inject(TicketService) private readonly tickets: TicketService, @Inject(DraftsService) private readonly drafts: DraftsService) {}
  @Get('tickets') list(@Req() request: AuthRequest) { return this.tickets.list(request.user, new Date()); }
  @Get('tickets/:id') get(@Req() request: AuthRequest, @Param('id') id: string) { return this.tickets.get(request.user, id, new Date()); }
  @Get('tickets/:id/history') history(@Req() request: AuthRequest, @Param('id') id: string) { return this.tickets.history(request.user, id); }
  @Post('ticket-drafts') create(@Req() request: AuthRequest, @Body() body: unknown) {
    const parsed = DraftInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    return this.drafts.create(request.user, parsed.data);
  }
  @Get('ticket-drafts/:id') draft(@Req() request: AuthRequest, @Param('id') id: string) { return this.drafts.get(request.user, id); }
  @Post('ticket-drafts/:id/edit') edit(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = z.strictObject({ version: z.number().int().positive(), input: DraftInputSchema }).safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    return this.drafts.edit(request.user, id, parsed.data.version, parsed.data.input);
  }
  @Post('ticket-drafts/:id/cancel') cancel(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = z.strictObject({ version: z.number().int().positive() }).safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    return this.drafts.cancel(request.user, id, parsed.data.version);
  }
}
