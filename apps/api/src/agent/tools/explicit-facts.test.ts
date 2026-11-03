import { describe, expect, it } from 'vitest';
import { deriveClassification, explicitFacts } from './explicit-facts.js';

describe('explicit service desk facts', () => {
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
