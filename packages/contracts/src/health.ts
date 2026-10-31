import { z } from 'zod';

export const HealthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('nexo-api'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ReadinessResponseSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('nexo-api'),
  database: z.literal('ready'),
});

export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;

export const UnavailableResponseSchema = z.strictObject({
  status: z.literal('unavailable'),
  service: z.literal('nexo-api'),
  database: z.literal('unavailable'),
});

export type UnavailableResponse = z.infer<typeof UnavailableResponseSchema>;
