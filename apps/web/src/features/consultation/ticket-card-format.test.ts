import { describe, expect, it } from 'vitest';
import { formatCreatedAt, formatDeadline, formatElapsed } from './ticket-card-format.js';

const now = new Date('2026-11-04T12:00:00.000Z');

describe('B08: ticket card dates', () => {
  it('describes the elapsed time since the last update in whole days or hours', () => {
    expect(formatElapsed('2026-10-30T12:00:00.000Z', now)).toBe('há 5 dias');
    expect(formatElapsed('2026-11-04T09:00:00.000Z', now)).toBe('há 3 horas');
    expect(formatElapsed('2026-11-04T11:30:00.000Z', now)).toBe('há menos de 1 hora');
  });
  it('shows no date when the ticket has no recorded last update', () => {
    expect(formatElapsed(null, now)).toBe('—');
  });
  it('formats the deadline in the service desk time zone', () => {
    const text = formatDeadline('2026-11-06T12:00:00.000Z');
    expect(text).toContain('06/11/2026');
    expect(text).toContain('09:00');
  });
  it('formats the creation date in the service desk time zone or shows no date', () => {
    expect(formatCreatedAt(null)).toBe('—');
    expect(formatCreatedAt('2026-11-04T01:00:00.000Z')).toBe('03/11/2026');
  });
});
