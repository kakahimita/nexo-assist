import type { ConfirmDraftInput, TicketEventView, TicketView, UserView } from '@nexo/contracts';
import { ForbiddenException } from '@nestjs/common';

export function assertEmployee(user: UserView): void {
  if (user.role !== 'employee') throw new ForbiddenException();
}

export abstract class TicketService {
  abstract list(user: UserView, now: Date): Promise<TicketView[]>;
  abstract get(user: UserView, id: string, now: Date): Promise<TicketView>;
  abstract history(user: UserView, id: string): Promise<TicketEventView[]>;
  abstract confirm(
    user: UserView,
    draftId: string,
    input: ConfirmDraftInput,
    now: Date,
  ): Promise<TicketView>;
}
