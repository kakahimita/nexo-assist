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

import { ticketStatusLabel as sharedTicketStatusLabel, type TicketStatus } from '@nexo/contracts';

export function ticketStatusLabel(status: TicketStatus): string {
  return sharedTicketStatusLabel(status);
}
