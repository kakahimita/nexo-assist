const hour = 60 * 60 * 1000;
const day = 24 * hour;

export function formatElapsed(value: string | null, now: Date): string {
  if (value === null) return '—';
  const elapsed = now.getTime() - new Date(value).getTime();
  const days = Math.floor(elapsed / day);
  if (days >= 1) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  const hours = Math.floor(elapsed / hour);
  if (hours >= 1) return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  return 'há menos de 1 hora';
}

export function formatDeadline(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
