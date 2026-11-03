import { RequestContext } from '@mastra/core/request-context';
import type { UserView } from '@nexo/contracts';
export type ConsultationRequestContext = { user: UserView; now: Date; conversationId?: string; runId?: string };
export function createConsultationRequestContext(user: UserView, now: Date, conversationId?: string, runId?: string): RequestContext<ConsultationRequestContext> {
  const context = new RequestContext<ConsultationRequestContext>();
  context.set('user', user);
  context.set('now', now);
  if (conversationId) context.set('conversationId', conversationId);
  if (runId) context.set('runId', runId);
  return context;
}
