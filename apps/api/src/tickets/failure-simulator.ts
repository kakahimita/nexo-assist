import { Injectable } from '@nestjs/common';

export class TransientTicketError extends Error {}

@Injectable()
export class FailureSimulator {
  beforeOperation(): void { /* default: no simulated failure */ }
  afterCommit(): void { /* default: no simulated failure */ }
}

export function isTransientTicketError(error: unknown): boolean {
  if (error instanceof TransientTicketError) return true;
  if (!(error instanceof Error)) return false;
  const code = 'code' in error ? String(error.code) : '';
  return code === 'P2034' || code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED' || /SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(error.message);
}
