import { RequestContext } from '@mastra/core/request-context';
import type { UserView } from '@nexo/contracts';
export type ConsultationRequestContext = { user: UserView; now: Date };
export function createConsultationRequestContext(user: UserView, now: Date): RequestContext<ConsultationRequestContext> {
  const context = new RequestContext<ConsultationRequestContext>();
  context.set('user', user);
  context.set('now', now);
  return context;
}
