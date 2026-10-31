import { BadRequestException, Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { MessageInputSchema } from '@nexo/contracts';
import { z } from 'zod';
import { IdentityGuard, type AuthRequest } from '../identity/identity.guard.js';
import { ConversationsService } from './conversations.service.js';

@Controller('conversations')
@UseGuards(IdentityGuard)
export class ConversationsController {
  constructor(@Inject(ConversationsService) private readonly conversations: ConversationsService) {}
  @Get() list(@Req() request: AuthRequest) { return this.conversations.list(request.user); }
  @Post() create(@Req() request: AuthRequest, @Body() body: unknown) {
    if (!z.strictObject({}).safeParse(body).success) throw new BadRequestException();
    return this.conversations.create(request.user);
  }
  @Get(':id/messages') messages(@Req() request: AuthRequest, @Param('id') id: string) { return this.conversations.messages(request.user, id); }
  @Post(':id/messages') append(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = MessageInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    return this.conversations.append(request.user, id, parsed.data.content);
  }
}
