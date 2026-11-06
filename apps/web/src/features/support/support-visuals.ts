const avatarTones = ['blue', 'peach', 'lilac', 'mint', 'rose', 'slate', 'sand'] as const;

export type SupportAvatarTone = (typeof avatarTones)[number];

export function supportAvatarTone(name: string): SupportAvatarTone {
  let hash = 0;

  for (const character of name) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 1_000_003;
  }

  return avatarTones[hash % avatarTones.length]!;
}

const timeZone = 'America/Sao_Paulo';
const dayFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone,
  hour: '2-digit',
  minute: '2-digit',
});
const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone,
  day: '2-digit',
  month: '2-digit',
});
const fullDateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone,
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatFullDateTime(iso: string): string {
  return fullDateTimeFormatter.format(new Date(iso));
}

export function formatMessageTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDayKey(iso: string): string {
  return dayFormatter.format(new Date(iso));
}

export function formatDayLabel(iso: string, now = new Date()): string {
  const key = formatDayKey(iso);

  if (key === formatDayKey(now.toISOString())) return 'Hoje';
  if (key === formatDayKey(new Date(now.getTime() - 86_400_000).toISOString())) return 'Ontem';

  return shortDateFormatter.format(new Date(iso));
}

export function formatQueueTime(iso: string, now = new Date()): string {
  const key = formatDayKey(iso);

  if (key === formatDayKey(now.toISOString())) return timeFormatter.format(new Date(iso));
  if (key === formatDayKey(new Date(now.getTime() - 86_400_000).toISOString())) return 'ontem';

  return shortDateFormatter.format(new Date(iso));
}
