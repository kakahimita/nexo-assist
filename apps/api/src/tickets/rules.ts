export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type Impact = 'self' | 'team' | 'company' | 'unknown';
export type WorkState = 'stopped' | 'workaround' | 'request' | 'unknown';
export type Urgency = 'same_day' | 'normal' | 'unknown';

export function classifyPriority(facts: { impact: Impact; workState: WorkState; urgency: Urgency }): Priority | null {
  const { impact, workState, urgency } = facts;
  if (impact === 'unknown' || workState === 'unknown' || urgency === 'unknown') return null;
  if (workState === 'stopped' && impact !== 'self') return 'critical';
  if (workState === 'stopped' || urgency === 'same_day') return 'high';
  if (workState === 'workaround') return 'medium';
  return 'low';
}

const HOUR = 60 * 60 * 1000;
const zone = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

interface LocalDateTime { year: number; month: number; day: number; hour: number; minute: number; second: number }

function inSaoPaulo(instant: number): LocalDateTime {
  const parts = Object.fromEntries(zone.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) };
}

// Opening and closing times always occur outside São Paulo's historical midnight DST transitions.
function localHour(day: LocalDateTime, hour: number): number {
  const desired = Date.UTC(day.year, day.month - 1, day.day, hour);
  let instant = desired;
  for (let attempt = 0; attempt < 4; attempt++) {
    const local = inSaoPaulo(instant);
    const observed = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const adjustment = desired - observed;
    if (adjustment === 0) return instant;
    instant += adjustment;
  }
  throw new Error('Could not resolve business time in America/Sao_Paulo');
}

function nextDay(day: LocalDateTime): LocalDateTime {
  const next = new Date(Date.UTC(day.year, day.month - 1, day.day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate(), hour: 0, minute: 0, second: 0 };
}

export function deadline(start: Date, priority: Priority): Date {
  if (priority === 'critical') return new Date(start.getTime() + HOUR);
  let remaining = { high: 4, medium: 30, low: 50 }[priority] * HOUR;
  let cursor = start.getTime();
  while (remaining > 0) {
    const day = inSaoPaulo(cursor);
    const weekday = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
    const open = localHour(day, 8);
    const close = localHour(day, 18);
    if (weekday === 0 || weekday === 6 || cursor >= close) {
      cursor = localHour(nextDay(day), 8);
      continue;
    }
    cursor = Math.max(cursor, open);
    const available = close - cursor;
    if (remaining <= available) return new Date(cursor + remaining);
    remaining -= available;
    cursor = localHour(nextDay(day), 8);
  }
  return new Date(cursor);
}

export function isOverdue(due: Date, now: Date): boolean {
  return now.getTime() > due.getTime();
}

export function canReopen(resolvedAt: Date, now: Date): boolean {
  const elapsed = now.getTime() - resolvedAt.getTime();
  return elapsed >= 0 && elapsed <= 7 * 24 * HOUR;
}
