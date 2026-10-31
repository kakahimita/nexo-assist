import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

import type { ApiEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';

@Module({})
export class AppModule {
  static register(environment: ApiEnvironment): DynamicModule {
    return {
      module: AppModule,
      imports: [DatabaseModule.register(environment.databaseUrl), HealthModule],
    };
  }
}
