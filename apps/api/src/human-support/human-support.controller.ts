import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupportConversationFilterSchema, SupportReplyInputSchema } from '@nexo/contracts';
import { IdentityGuard, type AuthRequest } from '../identity/identity.guard.js';
import { HumanSupportService } from './human-support.service.js';

@Controller('support')
@UseGuards(IdentityGuard)
export class HumanSupportController {
  constructor(@Inject(HumanSupportService) private readonly support: HumanSupportService) {}

  @Get('conversations')
  queue(@Req() request: AuthRequest, @Query('filter') filter?: unknown) {
    const parsed = SupportConversationFilterSchema.safeParse(filter ?? 'all');
    if (!parsed.success) throw new BadRequestException();
    return this.support.queue(request.user, parsed.data);
  }

  @Get('conversations/:id')
  detail(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.support.detail(request.user, id);
  }

  @Post('conversations/:id/claim')
  claim(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.support.claim(request.user, id);
  }

  @Post('conversations/:id/reply')
  reply(@Req() request: AuthRequest, @Param('id') id: string, @Body() body: unknown) {
    const parsed = SupportReplyInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    return this.support.reply(request.user, id, parsed.data.content);
  }

  @Post('conversations/:id/return')
  returnToAgent(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.support.returnToAgent(request.user, id);
  }

  @Post('conversations/:id/close')
  close(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.support.close(request.user, id);
  }
}
