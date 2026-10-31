import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';

import type { PrismaClient } from '../generated/prisma/client.js';
import { DATABASE_URL, createDatabaseClient } from './client.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(DATABASE_URL) databaseUrl: string) {
    this.client = createDatabaseClient(databaseUrl);
  }

  async isReady(): Promise<boolean> {
    try {
      const marker = await this.client.systemMetadata.findUnique({
        where: { key: 'installation-id' },
      });

      return marker !== null && marker.value.trim().length > 0;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
