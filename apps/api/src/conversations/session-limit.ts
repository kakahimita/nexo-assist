import { ConflictException } from '@nestjs/common';
import { CONVERSATION_MESSAGE_LIMIT } from '@nexo/contracts';

export class SessionLimitReachedError extends ConflictException {
  readonly limit = CONVERSATION_MESSAGE_LIMIT;
  constructor(readonly used: number) {
    super({ code: 'session_limit', limit: CONVERSATION_MESSAGE_LIMIT, used });
  }
}
