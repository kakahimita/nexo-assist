import { Controller, Get, Header, Inject, Injectable, Module } from '@nestjs/common';
import { ServiceMetricsSchema } from '@nexo/contracts';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class MetricsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async snapshot() {
    // One transaction keeps counts and samples from different requests consistent.
    return this.database.client.$transaction(async (tx) => {
      const now = new Date();
      const conversations = await tx.conversation.findMany({
        select: {
          resolvedByAgentMessageId: true,
          handoffRequestedAt: true,
          messages: {
            where: { role: { in: ['employee', 'agent'] } },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: {
              role: true,
              status: true,
              createdAt: true,
              decision: { select: { source: true, outcome: true } },
            },
          },
        },
      });
      const timings: number[] = [];
      let resolved = 0;
      let concluded = 0;
      for (const conversation of conversations) {
        if (conversation.handoffRequestedAt || conversation.resolvedByAgentMessageId) concluded++;
        if (conversation.resolvedByAgentMessageId && !conversation.handoffRequestedAt) resolved++;
        const employee = conversation.messages.find((message) => message.role === 'employee');
        const agent = conversation.messages.find(
          (message) =>
            message.role === 'agent' &&
            message.status === 'completed' &&
            message.decision?.source === 'live' &&
            message.decision.outcome === 'completed',
        );
        if (employee && agent && agent.createdAt >= employee.createdAt)
          timings.push((agent.createdAt.getTime() - employee.createdAt.getTime()) / 1000);
      }
      const analysts = await tx.session.findMany({
        where: {
          expiresAt: { gt: now },
          lastSeenAt: { gt: new Date(now.getTime() - 60_000), lte: now },
          user: { role: 'analyst' },
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      return ServiceMetricsSchema.parse({
        firstResponseSeconds: timings.length
          ? timings.reduce((sum, value) => sum + value, 0) / timings.length
          : null,
        responseSamples: timings.length,
        resolutionPercent: concluded ? (resolved / concluded) * 100 : null,
        resolvedWithoutQueue: resolved,
        concludedConversations: concluded,
        onlineAnalysts: analysts.length,
        generatedAt: now.toISOString(),
      });
    });
  }
}

@Controller('metrics')
class MetricsController {
  constructor(@Inject(MetricsService) private readonly metrics: MetricsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  snapshot() {
    return this.metrics.snapshot();
  }
}

@Module({ controllers: [MetricsController], providers: [MetricsService] })
export class MetricsModule {}
