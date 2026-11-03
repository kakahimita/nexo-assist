import type { ConsultationDecisionView } from '@nexo/contracts';
const labels: Record<ConsultationDecisionView['action'], string> = {
  answer: 'Responder',
  clarify: 'Pedir esclarecimento',
  redirect: 'Redirecionar',
  handoff: 'Encaminhar para atendimento humano',
  unavailable: 'Indisponível',
};
export function actionLabel(action: ConsultationDecisionView['action']): string {
  return labels[action];
}
