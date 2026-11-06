import { describe, expect, it } from 'vitest';

import { getEmployeeInitials } from './employee-initials.js';

describe('getEmployeeInitials', () => {
  it('uses the first and last name initials after trimming whitespace', () => {
    expect(getEmployeeInitials(' Ana   Souza ')).toBe('AS');
  });

  it('uses one initial for a single-part name', () => {
    expect(getEmployeeInitials('Ana')).toBe('A');
  });

  it('returns no initials when the name is blank', () => {
    expect(getEmployeeInitials('   ')).toBe('');
  });
});
