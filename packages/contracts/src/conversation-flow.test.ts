import { describe, expect, it } from 'vitest';
import { ConversationFlowSchema } from './conversation-flow.js';

describe('ConversationFlowSchema', () => {
  it('preserves a support case while a ticket consultation is active', () => {
    expect(
      ConversationFlowSchema.parse({
        mode: 'ticket_consultation',
        stage: 'select_ticket',
        facts: {},
        suspendedSupport: {
          mode: 'support',
          stage: 'diagnosis',
          facts: { subject: 'VPN', platform: 'Windows 11', errorCode: '804' },
        },
      }),
    ).toEqual({
      mode: 'ticket_consultation',
      stage: 'select_ticket',
      facts: {},
      suspendedSupport: {
        mode: 'support',
        stage: 'diagnosis',
        facts: { subject: 'VPN', platform: 'Windows 11', errorCode: '804' },
      },
    });
  });
});
