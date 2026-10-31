import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['**/*.test.ts'],
          exclude: [
            '**/*.integration.test.ts',
            '**/node_modules/**',
            '**/dist/**',
            '**/.next/**',
            '**/generated/**',
          ],
        },
      },
      {
        test: {
          name: 'integration',
          testTimeout: 30000,
          include: ['**/*.integration.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/generated/**'],
        },
      },
    ],
  },
});
