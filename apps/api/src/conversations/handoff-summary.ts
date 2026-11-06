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
  initialMessage?: string | undefined;
  recentMessages?: Array<{ role: string; content: string }>;
}): string {
  const latest = input.latestMessage?.trim().slice(0, 500);
  const ticketContext =
    input.openTicketCount === 0
      ? 'Não há chamados abertos vinculados ao funcionário.'
      : `${input.openTicketCount} chamado(s) aberto(s) do funcionário.`;
  const core = [
    reasonText[input.reason],
    input.initialMessage
      ? `Relato inicial: ${input.initialMessage.trim().slice(0, 500)}`
      : undefined,
    latest ? `Última mensagem: ${latest}` : undefined,
    ticketContext,
  ]
    .filter((value): value is string => value !== undefined)
    .join(' ');
  if (!input.recentMessages?.length) return core;
  const prefix = ' Histórico recente (resumo): ';
  const budget = 2000 - core.length - prefix.length;
  const history = input.recentMessages
    .map(
      (message) =>
        `${message.role === 'employee' ? 'Funcionário' : message.role === 'agent' ? 'Assistente' : 'Atendente'}: ${message.content.trim().slice(0, 300)}`,
    )
    .join(' | ');
  return core + prefix + history.slice(-budget);
}
