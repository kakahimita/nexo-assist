import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupportConversationFilterSchema } from '@nexo/contracts';
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
}
