'use client';
import type { ConsultationDecisionView } from '@nexo/contracts';
export function Decision({ decision }: { decision: ConsultationDecisionView }): React.JSX.Element {
  return <details className="decision-detail"><summary>Detalhes da decisão</summary><dl>
    <dt>Intenção interpretada</dt><dd>{decision.intent}</dd>
    <dt>Ação escolhida</dt><dd>{decision.action}</dd>
    <dt>Regra aplicada</dt><dd>{decision.appliedRule}</dd>
    <dt>Confiança estimada</dt><dd>{Math.round(decision.confidence * 100)}%</dd>
    <dt>Justificativa</dt><dd>{decision.justification}</dd>
    <dt>Informações faltantes</dt><dd>{decision.missingFacts.length ? decision.missingFacts.join(', ') : 'Nenhuma'}</dd>
    <dt>Evidências</dt><dd>{decision.evidence.length ? decision.evidence.map((item) => item.title).join(', ') : 'Nenhuma'}</dd>
  </dl></details>;
}
