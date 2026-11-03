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
];

describe('B13: conversational draft migration', () => {
  it('preserves previous decisions and uniquely binds a draft to one run through restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'nexo-draft-migration-'));
    const path = join(directory, 'test.db');
    let db = new DatabaseSync(path);
    try {
      for (const name of previous)
        db.exec(readFileSync(join(migrations, name, 'migration.sql'), 'utf8'));
      db.exec(`INSERT INTO User (id, email, name, role) VALUES ('u', 'u@example.com', 'U', 'employee');
        INSERT INTO Conversation (id, ownerId) VALUES ('c', 'u');
        INSERT INTO Message (id, content, conversationId, role) VALUES ('m', 'old', 'c', 'agent');
        INSERT INTO AgentDecision (id, messageId, intent, action, appliedRule, confidence, justification, missingFactsJson, quickRepliesJson, actionsJson, evidenceJson, ticketsJson, outcome, source, promptVersion) VALUES ('d', 'm', 'i', 'answer', 'r', 0.8, 'j', '[]', '[]', '[]', '[]', '[]', 'completed', 'deterministic', 'v1');`);
      db.exec(
        readFileSync(
          join(migrations, '20261103000000_conversational_drafts', 'migration.sql'),
          'utf8',
        ),
      );
      expect(db.prepare('SELECT draftId FROM AgentDecision WHERE id = ?').get('d')).toMatchObject({
        draftId: null,
      });
      db.exec(`INSERT INTO TicketDraft (id, ownerId) VALUES ('draft', 'u');
        INSERT INTO DraftProposalRun (id, ownerId, conversationId, draftId) VALUES ('run', 'u', 'c', 'draft');
        UPDATE AgentDecision SET draftId = 'draft' WHERE id = 'd';`);
      expect(() =>
        db.exec(
          `INSERT INTO DraftProposalRun (id, ownerId, conversationId, draftId) VALUES ('run', 'u', 'c', 'draft')`,
        ),
      ).toThrow();
      db.close();
      db = new DatabaseSync(path);
      expect(db.prepare('SELECT draftId FROM AgentDecision WHERE id = ?').get('d')).toMatchObject({
        draftId: 'draft',
      });
      expect(
        db
          .prepare('SELECT ownerId, conversationId, draftId FROM DraftProposalRun WHERE id = ?')
          .get('run'),
      ).toMatchObject({ ownerId: 'u', conversationId: 'c', draftId: 'draft' });
    } finally {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
