import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

import { DATABASE_URL } from './client.js';
import { DatabaseService } from './database.service.js';

@Module({})
export class DatabaseModule {
  static register(databaseUrl: string): DynamicModule {
    return {
      module: DatabaseModule,
      global: true,
      providers: [{ provide: DATABASE_URL, useValue: databaseUrl }, DatabaseService],
      exports: [DatabaseService],
    };
  }
}
