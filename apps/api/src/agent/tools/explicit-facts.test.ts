import { describe, expect, it } from 'vitest';
import { explicitFacts } from './explicit-facts.js';

describe('explicit service desk facts', () => {
  it('does not reuse answers from before a new request or after uncertainty', () => {
    const answers = ['Abrir chamado: notebook não liga', 'Somente eu', 'Consigo trabalhar com alternativa', 'Sem compromisso em risco hoje'];
    expect(explicitFacts(answers)).toEqual({ impact: 'self', workState: 'workaround', urgency: 'normal' });
    expect(explicitFacts([...answers, 'Abrir chamado: outro problema'])).toEqual({});
    expect(explicitFacts([...answers, 'Não sei'])).toEqual({});
  });
});
