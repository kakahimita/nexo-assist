import { describe, expect, it } from 'vitest';
import { deriveClassification, explicitFacts } from './explicit-facts.js';

describe('explicit service desk facts', () => {
  it('does not reuse facts when a different natural problem starts', () => {
    expect(
      explicitFacts([
        'Minha VPN está com erro 809',
        'Somente eu',
        'Não consigo trabalhar',
        'Sem compromisso em risco hoje',
        'Agora meu monitor está sem imagem',
      ]),
    ).toEqual({});
  });
  it('accepts a natural problem report without a ticket-opening command', () => {
    const messages = [
      'Minha VPN está com erro 809 no Windows 11',
      'Somente eu',
      'Não consigo trabalhar',
      'Sem compromisso em risco hoje',
    ];
    expect(explicitFacts(messages)).toEqual({
      impact: 'self',
      workState: 'stopped',
      urgency: 'normal',
    });
    expect(deriveClassification(messages, 'stopped')).toEqual({
      type: 'INC',
      category: 'network_vpn',
    });
  });

  it('accepts explicit natural facts while refusing ambiguous or negated impact', () => {
    expect(
      explicitFacts([
        'Meu monitor está sem imagem',
        'Só eu estou afetado',
        'Ainda consigo trabalhar com alternativa',
        'Não tenho compromisso em risco hoje',
      ]),
    ).toEqual({ impact: 'self', workState: 'workaround', urgency: 'normal' });
    expect(
      explicitFacts(['Meu monitor está sem imagem', 'Não é somente eu', 'Talvez seja a equipe']),
    ).toEqual({});
    expect(
      explicitFacts([
        'Minha VPN falha. Só eu estou afetado e não consigo trabalhar. Não tenho compromisso em risco hoje.',
      ]),
    ).toEqual({ impact: 'self', workState: 'stopped', urgency: 'normal' });
    expect(deriveClassification(['Meu notebook mostra erro 809 na VPN'], 'stopped')).toEqual({
      type: 'INC',
      category: 'network_vpn',
    });
  });
  it('does not reuse answers from before a new request or after uncertainty', () => {
    const answers = [
      'Abrir chamado: notebook não liga',
      'Somente eu',
      'Consigo trabalhar com alternativa',
      'Sem compromisso em risco hoje',
    ];
    expect(explicitFacts(answers)).toEqual({
      impact: 'self',
      workState: 'workaround',
      urgency: 'normal',
    });
    expect(explicitFacts([...answers, 'Abrir chamado: outro problema'])).toEqual({});
    expect(explicitFacts([...answers, 'Não sei'])).toEqual({});
  });

  it('derives the ticket type and category from the employee words', () => {
    expect(deriveClassification(['Abrir chamado: meu projetor não liga'], 'workaround')).toEqual({
      type: 'INC',
      category: 'hardware',
    });
    expect(
      deriveClassification(['Abrir chamado: preciso instalar um software'], 'request'),
    ).toEqual({ type: 'REQ', category: 'software' });
    expect(deriveClassification(['Abrir chamado: sem detalhes'], 'workaround')).toBeNull();
  });
});
