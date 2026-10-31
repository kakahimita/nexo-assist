import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { PrismaClient } from '../generated/prisma/client.js';

export const DATABASE_URL: unique symbol = Symbol('DATABASE_URL');

export function createDatabaseClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

  return new PrismaClient({ adapter });
}
