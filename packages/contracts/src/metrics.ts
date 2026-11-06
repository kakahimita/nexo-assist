import { z } from 'zod';

export const ResolutionInputSchema = z.strictObject({ messageId: z.string().min(1).max(128) });
export const ServiceMetricsSchema = z.strictObject({
  firstResponseSeconds: z.number().nonnegative().nullable(),
  responseSamples: z.number().int().nonnegative(),
  resolutionPercent: z.number().min(0).max(100).nullable(),
  resolvedWithoutQueue: z.number().int().nonnegative(),
  concludedConversations: z.number().int().nonnegative(),
  onlineAnalysts: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
});
export type ServiceMetrics = z.infer<typeof ServiceMetricsSchema>;
