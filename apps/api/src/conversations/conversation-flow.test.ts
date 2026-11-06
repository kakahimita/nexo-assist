import { describe, expect, it } from 'vitest';
import { restoreConversationFlow, transitionConversationFlow } from './conversation-flow.js';

describe('transitionConversationFlow', () => {
  it('does not turn a denied same-day commitment into urgency', () => {
    expect(
      transitionConversationFlow(
        { mode: 'support', stage: 'diagnosis', facts: { subject: 'VPN' } },
        'Não tenho compromisso em risco hoje',
      ).facts.urgency,
    ).toBe('normal');
  });
  it('keeps short diagnostic replies in the active support case', () => {
    const started = transitionConversationFlow(
      { mode: 'none', stage: 'idle', facts: {} },
      'Não consigo acessar a VPN.',
    );
    const continued = transitionConversationFlow(started, 'Windows 11 — erro 804');

    expect(continued).toEqual({
      mode: 'support',
      stage: 'diagnosis',
      facts: { subject: 'VPN', platform: 'Windows 11', errorCode: '804' },
    });
  });

  it('suspends any support case when the employee explicitly asks about tickets', () => {
    expect(
      transitionConversationFlow(
        {
          mode: 'support',
          stage: 'collecting_impact',
          facts: { subject: 'E-mail', platform: 'Windows 11' },
        },
        'Qual o status dos meus chamados?',
      ),
    ).toEqual({
      mode: 'ticket_consultation',
      stage: 'select_ticket',
      facts: {},
      suspendedSupport: {
        mode: 'support',
        stage: 'collecting_impact',
        facts: { subject: 'E-mail', platform: 'Windows 11' },
      },
    });
  });

  it('does not hijack a support case on a loose deadline or status mention', () => {
    const support = {
      mode: 'support' as const,
      stage: 'collecting_urgency' as const,
      facts: { subject: 'VPN' },
    };
    expect(transitionConversationFlow(support, 'Meu prazo é hoje')).toMatchObject({
      mode: 'support',
    });
    expect(transitionConversationFlow(support, 'Qual o status do Notebook lento?')).toMatchObject({
      mode: 'support',
    });
  });

  it('recovers a support case from legacy messages when no flow was stored', () => {
    expect(
      restoreConversationFlow({ mode: 'none', stage: 'idle', facts: {} }, [
        'Não consigo acessar a VPN.',
        'Windows 11',
        'erro 804',
      ]),
    ).toEqual({
      mode: 'support',
      stage: 'diagnosis',
      facts: { subject: 'VPN', platform: 'Windows 11', errorCode: '804' },
    });
  });
});
