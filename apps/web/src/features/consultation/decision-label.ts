import type { ConsultationDecisionView } from '@nexo/contracts';
const labels: Record<ConsultationDecisionView['action'], string> = {
  answer: 'Responder',
  clarify: 'Pedir esclarecimento',
  redirect: 'Redirecionar',
  unavailable: 'Indisponível',
};
export function actionLabel(action: ConsultationDecisionView['action']): string {
  return labels[action];
}
