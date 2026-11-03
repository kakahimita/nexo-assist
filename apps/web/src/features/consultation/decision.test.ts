import { describe, expect, it } from 'vitest';
import { actionLabel } from './decision-label.js';
describe('decision detail copy', () => {
  it('shows Portuguese labels for decision actions', () => {
    expect(actionLabel('answer')).toBe('Responder');
    expect(actionLabel('clarify')).toBe('Pedir esclarecimento');
    expect(actionLabel('redirect')).toBe('Redirecionar');
    expect(actionLabel('unavailable')).toBe('Indisponível');
  });
});
