import type { HandoffReason } from '@nexo/contracts';

const reasonText: Record<HandoffReason, string> = {
  employee_request: 'O funcionário solicitou atendimento humano.',
  critical_incident: 'Um incidente crítico requer atendimento humano.',
  overdue_ticket: 'Um chamado vencido requer atendimento humano.',
  unresolved_uncertainty: 'A solicitação precisa de decisão humana.',
};

export function formatHandoffSummary(input: {
  reason: HandoffReason;
  latestMessage: string | undefined;
  openTicketCount: number;
}): string {
  const latest = input.latestMessage?.trim().slice(0, 500);
  const ticketContext =
    input.openTicketCount === 0
      ? 'Não há chamados abertos vinculados ao funcionário.'
      : `${input.openTicketCount} chamado(s) aberto(s) do funcionário.`;
  return [
    reasonText[input.reason],
    latest ? `Última mensagem: ${latest}` : undefined,
    ticketContext,
  ]
    .filter((value): value is string => value !== undefined)
    .join(' ');
}
