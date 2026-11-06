import { describe, expect, it } from 'vitest';
import { ModelProposalInputSchema } from './consultation-tool-schemas.js';
import { validateSupportInterpretation } from './support-interpretation.js';

const messages = [
  { id: 'old', content: 'Minha equipe inteira parou.' },
  {
    id: 'current',
    content:
      'Meu projetor apagou. Só eu estou afetado. Há outra sala e não há compromisso em risco hoje.',
  },
  { id: 'future', content: 'Novo relato ainda fora da execução.' },
];
const fact = (value: string) => ({
  value,
  evidence: { messageId: 'current', quote: messages[1]!.content },
});
const interpretation = {
  requestStartMessageId: 'current',
  type: fact('INC'),
  category: fact('hardware'),
  impact: fact('self'),
  workState: fact('workaround'),
  urgency: fact('normal'),
};
describe('semantic support provenance', () => {
  it('requires semantic facts on the live tool instead of silently falling back to phrase matching', () => {
    expect(
      ModelProposalInputSchema.safeParse({
        action: 'create',
        title: 'Meu projetor apagou',
        description: 'Meu projetor apagou',
      }).success,
    ).toBe(false);
    expect(
      ModelProposalInputSchema.safeParse({
        action: 'create',
        title: 'Meu projetor apagou',
        description: 'Meu projetor apagou',
        interpretation,
      }).success,
    ).toBe(true);
  });
  it('rejects evidence outside the owned run snapshot or before the current problem', () => {
    expect(
      validateSupportInterpretation(interpretation, messages, ['old', 'current']),
    ).toMatchObject({ impact: 'self', urgency: 'normal' });
    for (const evidence of [
      { messageId: 'old', quote: messages[0]!.content },
      { messageId: 'future', quote: messages[2]!.content },
      { messageId: 'current', quote: 'invenção' },
    ])
      expect(() =>
        validateSupportInterpretation(
          { ...interpretation, urgency: { value: 'normal', evidence } },
          messages,
          ['old', 'current'],
        ),
      ).toThrow();
  });
});
