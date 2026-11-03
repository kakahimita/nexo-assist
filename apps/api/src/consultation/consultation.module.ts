import { Module, type DynamicModule } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { ConsultationTools } from '../agent/tools/consultation-tools.js';
import { createConsultationEngine } from '../agent/consultation/engine.js';
import type { ConsultationEngine } from '../agent/consultation/types.js';
import { ConsultationController } from './consultation.controller.js';
import { CONSULTATION_ENGINE, ConsultationService } from './consultation.service.js';
@Module({})
export class ConsultationModule {
  static register(mode: 'mastra' | 'fixture', override?: ConsultationEngine): DynamicModule {
    return { module: ConsultationModule, imports: [ConversationsModule, TicketsModule, KnowledgeModule], controllers: [ConsultationController], providers: [ConsultationTools, ConsultationService, { provide: CONSULTATION_ENGINE, inject: [ConsultationTools], useFactory: (tools: ConsultationTools) => override ?? createConsultationEngine(mode, tools) }] };
  }
}
