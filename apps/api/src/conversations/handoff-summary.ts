import type { HandoffReason } from '@nexo/contracts';

const reasonText: Record<HandoffReason, string> = {
  employee_request: 'O funcionÃ¡rio solicitou atendimento humano.',
  critical_incident: 'Um incidente crÃ­tico requer atendimento humano.',
  overdue_ticket: 'Um chamado vencido requer atendimento humano.',
  unresolved_uncertainty: 'A solicitaÃ§Ã£o precisa de decisÃ£o humana.',
};

export function formatHandoffSummary(input: {
  reason: HandoffReason;
  latestMessage: string | undefined;
  openTicketCount: number;
}): string {
  const latest = input.latestMessage?.trim().slice(0, 500);
  const ticketContext =
    input.openTicketCount === 0
      ? 'NÃ£o hÃ¡ chamados abertos vinculados ao funcionÃ¡rio.'
      : `${input.openTicketCount} chamado(s) aberto(s) do funcionÃ¡rio.`;
  return [
    reasonText[input.reason],
    latest ? `Ãšltima mensagem: ${latest}` : undefined,
    ticketContext,
  ]
    .filter((value): value is string => value !== undefined)
    .join(' ');
}
