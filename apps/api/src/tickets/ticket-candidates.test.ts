import { describe, expect, it } from 'vitest';
import { findTicketCandidates } from './ticket-candidates.js';

const tickets = [
  { id: 'a', title: 'Notebook lento', description: 'O notebook ficou lento após atualização', status: 'open' },
  { id: 'b', title: 'Notebook sem bateria', description: 'A bateria do notebook não carrega', status: 'open' },
  { id: 'c', title: 'Notebook lento', description: 'Notebook lento', status: 'resolved' },
] as const;

describe('B05: identify possible duplicate problems', () => {
  it('classifies exact titles and finds paraphrased candidates without treating them as certain', () => {
    expect(findTicketCandidates({ title: '  NOTEBOOK lento  ', description: 'x' }, tickets)).toEqual([{ ticket: tickets[0], match: 'exact' }]);
    expect(findTicketCandidates({ title: 'Computador portátil devagar', description: 'Lentidão após atualização' }, tickets)).toEqual([{ ticket: tickets[0], match: 'possible' }]);
  });
  it('does not suggest resolved tickets or unrelated issues sharing only a device', () => {
    expect(findTicketCandidates({ title: 'Notebook sem áudio', description: 'O som não funciona' }, tickets)).toEqual([]);
  });
  it('returns every plausible candidate for clarification', () => {
    const more = [...tickets, { id: 'd', title: 'Computador lento', description: 'Equipamento muito lento', status: 'open' }];
    expect(findTicketCandidates({ title: 'Notebook devagar', description: 'Notebook lento' }, more).map(({ ticket }) => ticket.id)).toEqual(['a', 'd']);
  });
});
