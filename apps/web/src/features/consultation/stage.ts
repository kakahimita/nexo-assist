import type { ConversationState } from '@nexo/contracts';

export type EmployeeStage = 'agent' | 'human' | 'closed';

export function employeeStage(state: ConversationState): EmployeeStage {
  if (state === 'waiting_for_analyst' || state === 'with_analyst') return 'human';
  if (state === 'closed') return 'closed';
  return 'agent';
}
