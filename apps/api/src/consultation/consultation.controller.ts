import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { MessageInputSchema } from '@nexo/contracts';
import type { ServerResponse } from 'node:http';
import { IdentityGuard, type AuthRequest } from '../identity/identity.guard.js';
import { ConversationsService } from '../conversations/conversations.service.js';
import { ConsultationService } from './consultation.service.js';
import { encodeSse } from './sse.js';
import { randomUUID } from 'node:crypto';
@Controller('conversations')
@UseGuards(IdentityGuard)
export class ConsultationController {
  constructor(
    @Inject(ConversationsService) private readonly conversations: ConversationsService,
    @Inject(ConsultationService) private readonly consultation: ConsultationService,
  ) {}
  @Post(':id/messages/stream')
  async stream(
    @Req() request: AuthRequest,
    @Res() response: ServerResponse,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const parsed = MessageInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException();
    const accepted = await this.conversations.append(request.user, id, parsed.data.content);
    const abort = new AbortController();
    let complete = false;
    response.on('close', () => {
      if (!complete) abort.abort();
    });
    response.statusCode = 201;
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    try {
      for await (const event of this.consultation.run(
        request.user,
        id,
        accepted,
        abort.signal,
        randomUUID(),
      )) {
        if (!response.destroyed) response.write(encodeSse(event));
      }
    } catch {
      if (!response.destroyed)
        response.write(encodeSse({ type: 'error', code: 'model_unavailable' }));
    } finally {
      complete = true;
      if (!response.destroyed) response.end();
    }
  }
}
