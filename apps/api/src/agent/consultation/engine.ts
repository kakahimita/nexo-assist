import type { ConsultationTools } from '../tools/consultation-tools.js';
import { createFixtureConsultation } from './fixture-consultation.js';
import { createMastraConsultation } from './mastra-consultation.js';
import type { ConsultationEngine } from './types.js';
export function createConsultationEngine(mode: 'mastra' | 'fixture', tools: ConsultationTools): ConsultationEngine {
  return mode === 'fixture' ? createFixtureConsultation(tools) : createMastraConsultation(tools);
}
