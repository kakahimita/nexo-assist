import { describe, expect, it } from 'vitest';
import { canReopen, classifyPriority, deadline, isOverdue } from './rules.js';

describe('B07: priority from impact and urgency', () => {
  it.each([
    ['team', 'stopped', 'normal', 'critical'],
    ['company', 'stopped', 'same_day', 'critical'],
    ['self', 'stopped', 'normal', 'high'],
    ['self', 'workaround', 'same_day', 'high'],
    ['self', 'request', 'same_day', 'high'],
    ['self', 'workaround', 'normal', 'medium'],
    ['self', 'request', 'normal', 'low'],
    ['unknown', 'stopped', 'normal', null],
    ['self', 'unknown', 'normal', null],
    ['self', 'request', 'unknown', null],
  ] as const)('classifies %s / %s / %s', (impact, workState, urgency, expected) => {
    expect(classifyPriority({ impact, workState, urgency })).toBe(expected);
  });
});

describe('B08: São Paulo business deadlines', () => {
  const friday = new Date('2026-10-30T20:00:00.000Z');
  it.each([
    ['critical', '2026-10-30T21:00:00.000Z'],
    ['high', '2026-11-02T14:00:00.000Z'],
    ['medium', '2026-11-04T20:00:00.000Z'],
    ['low', '2026-11-06T20:00:00.000Z'],
  ] as const)('calculates %s from Friday 17:00', (priority, expected) => {
    expect(deadline(friday, priority).toISOString()).toBe(expected);
    expect(friday.toISOString()).toBe('2026-10-30T20:00:00.000Z');
  });
  it('starts at the next opening when created at closing', () => {
    expect(deadline(new Date('2026-10-30T21:00:00Z'), 'high').toISOString()).toBe(
      '2026-11-02T15:00:00.000Z',
    );
  });
  it('uses the historical offset after a daylight-saving transition', () => {
    expect(deadline(new Date('2019-02-15T19:00:00Z'), 'high').toISOString()).toBe(
      '2019-02-18T14:00:00.000Z',
    );
  });
  it('computes a new deadline for a later support update', () => {
    expect(deadline(new Date('2026-11-02T13:00:00Z'), 'high').toISOString()).toBe(
      '2026-11-02T17:00:00.000Z',
    );
  });
  it('becomes overdue only after the exact deadline', () => {
    const due = new Date('2026-11-02T14:00:00Z');
    expect(isOverdue(due, new Date('2026-11-02T14:00:00Z'))).toBe(false);
    expect(isOverdue(due, new Date('2026-11-02T14:00:00.001Z'))).toBe(true);
  });
});

describe('B06: seven elapsed days for reopening', () => {
  const resolved = new Date('2026-10-01T12:00:00Z');
  it('includes exactly seven days but excludes later or earlier instants', () => {
    expect(canReopen(resolved, new Date('2026-10-08T12:00:00Z'))).toBe(true);
    expect(canReopen(resolved, new Date('2026-10-08T12:00:00.001Z'))).toBe(false);
    expect(canReopen(resolved, new Date('2026-09-30T12:00:00Z'))).toBe(false);
  });
});
