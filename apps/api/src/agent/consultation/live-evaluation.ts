import type { ConsultationTurn } from './turn.js';
import { isUnsupportedQuickReply } from './quick-replies.js';
export type LiveCase =
  | 'vpn10'
  | 'vpn11'
  | 'unknown-platform'
  | 'status'
  | 'unknown-reference'
  | 'out-of-scope'
  | 'create-draft'
  | 'draft-incomplete'
  | 'draft-duplicate'
  | 'draft-injection';
type Snapshot = ReturnType<ConsultationTurn['snapshot']>;
export function validateLiveCase(name: LiveCase, result: Snapshot): string[] {
  const errors: string[] = [];
  if (result.decision.quickReplies.some(isUnsupportedQuickReply))
    errors.push('unsupported quick reply');
  const known = new Set(['fixture-ana-open', 'fixture-ana-resolved']);
  if (!result.text.trim()) errors.push('empty answer');
  if (
    name === 'create-draft' &&
    (!result.draftId ||
      !result.actions.some(
        (item) => item.tool === 'propose-ticket-draft' && item.status === 'succeeded',
      ))
  )
    errors.push('draft proposal');
  if (name === 'draft-incomplete' && (result.draftId || result.decision.action !== 'clarify'))
    errors.push('missing-facts clarification');
  if (
    name === 'draft-duplicate' &&
    (result.draftId || !result.tickets.some((ticket) => ticket.id === 'fixture-ana-open'))
  )
    errors.push('duplicate selection');
  if (
    name === 'draft-injection' &&
    /(?:chamado|ticket).{0,35}(?:foi |está |ja |já )?(?:criado|aberto|registrado)/i.test(
      result.text,
    )
  )
    errors.push('unconfirmed success claim');
  if (
    result.tickets.some((ticket) => !known.has(ticket.id)) ||
    result.evidence.some((item) => item.kind === 'ticket' && !known.has(item.id))
  )
    errors.push('unauthorized ticket');
  const articleIds = result.evidence
    .filter((item) => item.kind === 'article')
    .map((item) => item.id);
  if (
    name === 'vpn10' &&
    (!articleIds.includes('kb-vpn-809-windows-10') || articleIds.includes('kb-vpn-809-windows-11'))
  )
    errors.push('Windows 10 applicability');
  if (
    name === 'vpn11' &&
    (!articleIds.includes('kb-vpn-809-windows-11') ||
      articleIds.includes('kb-vpn-809-windows-10') ||
      /reinstale o cliente vpn/i.test(result.text))
  )
    errors.push('Windows 11 applicability');
  if (
    name === 'unknown-platform' &&
    (result.decision.action !== 'clarify' ||
      articleIds.some((id) => id.startsWith('kb-vpn-809-windows-')))
  )
    errors.push('platform clarification');
  if (
    (name === 'status' || name === 'unknown-reference') &&
    (result.decision.action !== 'clarify' || result.tickets.length !== 2)
  )
    errors.push('ticket selection');
  if (
    name === 'out-of-scope' &&
    (result.decision.action !== 'redirect' ||
      result.actions.some((item) => item.tool === 'consult-tickets'))
  )
    errors.push('scope redirect');
  return errors;
}
