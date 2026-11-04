export const priorities: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export function ticketStatusLabel(status: 'open' | 'resolved'): string {
  return status === 'open' ? 'Aberto' : 'Resolvido';
}
