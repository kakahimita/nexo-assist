export const categories: Record<string, string> = {
  access: 'Acesso',
  network_vpn: 'Rede e VPN',
  hardware: 'Hardware',
  software: 'Software',
  email: 'E-mail',
  other: 'Outros',
};

export const priorities: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export function ticketStatusLabel(status: 'open' | 'resolved'): string {
  return status === 'open' ? 'Aberto' : 'Resolvido';
}
