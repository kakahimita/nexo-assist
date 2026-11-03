import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

import type { ApiEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { ConversationsModule } from './conversations/conversations.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { KnowledgeModule } from './knowledge/knowledge.module.js';
import { HumanSupportModule } from './human-support/human-support.module.js';
import { ConsultationTools } from './agent/tools/consultation-tools.js';
import { ConsultationModule } from './consultation/consultation.module.js';
import type { ConsultationEngine } from './agent/consultation/types.js';

@Module({})
export class AppModule {
  static register(
    environment: ApiEnvironment,
    overrides?: { consultationEngine?: ConsultationEngine },
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DatabaseModule.register(environment.databaseUrl),
        HealthModule,
        IdentityModule.register(environment.webOrigin.startsWith('https://')),
        ConversationsModule,
        TicketsModule,
        KnowledgeModule,
        HumanSupportModule,
        ConsultationModule.register(
          environment.consultationEngine ?? 'mastra',
          overrides?.consultationEngine,
        ),
      ],
      providers: [ConsultationTools],
    };
  }
}
