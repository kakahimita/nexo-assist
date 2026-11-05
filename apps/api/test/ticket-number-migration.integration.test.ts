import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migrations = resolve('apps/api/prisma/migrations');
const previous = [
  '20261031000000_foundation',
  '20261031010000_identity_history',
  '20261102000000_tickets',
  '20261102010000_knowledge_articles',
  '20261102020000_consultation_evidence',
  '20261103000000_conversational_drafts',
  '20261103010000_add_conversation_handoff',
  '20261103191858_add_analyst_ownership',
];
const current = '20261105150000_ticket_number_and_status';

describe('B13: ticket number and status migration', () => {
  it('backfills numbers per type and initializes the sequence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'nexo-ticket-number-'));
    const path = join(directory, 'test.db');
    const db = new DatabaseSync(path);
    try {
      for (const name of previous)
        db.exec(readFileSync(join(migrations, name, 'migration.sql'), 'utf8'));
      db.exec(`INSERT INTO User (id, email, name, role) VALUES ('u', 'u@example.com', 'U', 'employee');
        INSERT INTO Ticket (id, ownerId, title, normalizedTitle, description, type, category, priority, impact, slaStartedAt, createdAt, status) VALUES
          ('inc-old', 'u', 'A', 'a', 'd', 'INC', 'hardware', 'low', 'self', '2026-10-01T08:00:00Z', '2026-10-01T08:00:00Z', 'open'),
          ('inc-new', 'u', 'B', 'b', 'd', 'INC', 'hardware', 'low', 'self', '2026-10-02T08:00:00Z', '2026-10-02T08:00:00Z', 'resolved'),
          ('req', 'u', 'C', 'c', 'd', 'REQ', 'access', 'low', 'self', '2026-10-03T08:00:00Z', '2026-10-03T08:00:00Z', 'open');
        INSERT INTO Conversation (id, ownerId) VALUES ('c', 'u');`);

      db.exec(readFileSync(join(migrations, current, 'migration.sql'), 'utf8'));

      expect(
        db.prepare('SELECT id, number FROM Ticket ORDER BY createdAt').all(),
      ).toEqual([
        { id: 'inc-old', number: 20000 },
        { id: 'inc-new', number: 20001 },
        { id: 'req', number: 10000 },
      ]);
      expect(db.prepare('SELECT type, value FROM TicketNumberSequence ORDER BY type').all()).toEqual(
        [
          { type: 'INC', value: 20001 },
          { type: 'REQ', value: 10000 },
        ],
      );
      expect(db.prepare('SELECT contextTicketId FROM Conversation WHERE id = ?').get('c')).toEqual({
        contextTicketId: null,
      });
      expect(() =>
        db.exec(`INSERT INTO Ticket (id, ownerId, title, normalizedTitle, description, type, category, priority, impact, slaStartedAt, number) VALUES ('dup','u','t','t','d','INC','hardware','low','self',CURRENT_TIMESTAMP,20000)`),
      ).toThrow();
    } finally {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
