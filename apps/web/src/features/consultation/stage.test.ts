import { describe, expect, it } from 'vitest';
import { employeeStage } from './stage.js';

describe('employee conversation stage', () => {
  it('treats waiting and owned conversations as human-engaged and closed as terminal', () => {
    expect(employeeStage('agent')).toBe('agent');
    expect(employeeStage('waiting_for_analyst')).toBe('human');
    expect(employeeStage('with_analyst')).toBe('human');
    expect(employeeStage('closed')).toBe('closed');
  });
});
