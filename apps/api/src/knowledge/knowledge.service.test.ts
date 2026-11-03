import { describe, expect, it } from 'vitest';
import { assessApplicability, normalizePlatform, KnowledgeService } from './knowledge.service.js';
import { createTestDatabase } from '../../test/support/test-database.js';
import { DatabaseService } from '../database/database.service.js';

describe('B02 / PRD pp. 1, 4: knowledge applicability', () => {
  it.each([['Windows 11', 'windows11'], ['win11', 'windows11'], ['Windows 10', 'windows10'], ['win10', 'windows10'], [undefined, 'unknown'], ['Linux', 'unknown']] as const)('normalizes %s', (input, expected) => {
    expect(normalizePlatform(input)).toBe(expected);
  });
  it('does not apply Windows 10 guidance to Windows 11 or unknown platforms', () => {
    expect(assessApplicability({ platform: 'windows10' }, 'windows10').applicability).toBe('applicable');
    expect(assessApplicability({ platform: 'windows10' }, 'windows11').applicability).toBe('platform_mismatch');
    expect(assessApplicability({ platform: 'windows10' }, 'unknown').applicability).toBe('platform_unknown');
  });
  it('retrieves relevant articles with platform-specific applicability and excludes unrelated topics', async () => {
    const db = await createTestDatabase();
    const database = new DatabaseService(db.url);
    try {
      const service = new KnowledgeService(database);
      for (const [platform, applicable, mismatch] of [['windows11', 'kb-vpn-809-windows-11', 'kb-vpn-809-windows-10'], ['windows10', 'kb-vpn-809-windows-10', 'kb-vpn-809-windows-11']] as const) {
        const results = await service.search('VPN erro 809', platform);
        expect(results.find((item) => item.id === applicable)?.applicability).toBe('applicable');
        expect(results.find((item) => item.id === mismatch)?.applicability).toBe('platform_mismatch');
      }
      const unknown = await service.search('VPN erro 809', undefined);
      expect(unknown.filter((item) => item.platform !== 'any').every((item) => item.applicability === 'platform_unknown')).toBe(true);
      expect(await service.search('férias no RH', undefined)).toEqual([]);
      expect(await service.search('xyzzy', undefined)).toEqual([]);
    } finally { await database.onModuleDestroy(); await db.cleanup(); }
  }, 30000);
});
