import type { CwrAcknowledgment, CwrTransaction } from './cwr.js';

export type CwrOutcome = 'received' | 'processing' | 'accepted' | 'rejected' | 'duplicate' | 'conflict' | 'review_required';
export interface CwrWorkOutcome {
  revision: number; batchId: string; workId: string; entityId?: string; sender: string;
  processingDate: string; status: string; outcome: CwrOutcome; recipientWorkId: string;
  source: 'user_import' | 'receiver_transport'; independentlyVerified: boolean; evidenceHash: string;
}
export function cwrAckOutcome(ack: CwrAcknowledgment, sender: string): CwrOutcome {
  // MusicMark's first ACK only establishes receipt by the routing hub.
  if (Number(sender) === 707 && ['RA', 'AS', 'AC'].includes(ack.status)) return 'received';
  if (ack.status === 'RA') return 'processing';
  if (['AS', 'AC'].includes(ack.status)) return ack.recipientWorkId ? 'accepted' : 'review_required';
  if (['RJ', 'RC'].includes(ack.status)) return 'rejected';
  if (ack.status === 'DU') return 'duplicate';
  if (ack.status === 'CO') return 'conflict';
  return 'review_required';
}
export function correlateCwrAck(ack: CwrAcknowledgment, transaction: CwrTransaction | undefined, createdAt: string): void {
  if (!transaction || !transaction.type || transaction.workId !== ack.workId || transaction.type !== ack.type || !!transaction.title && transaction.title !== ack.title
    || transaction.group !== ack.group || transaction.transaction !== ack.transaction
    || ack.originalDate !== createdAt.slice(0, 10).replace(/-/g, '') || ack.originalTime !== createdAt.slice(11, 19).replace(/:/g, '')) {
    throw new Error('ACK cannot be unambiguously correlated to this batch. Legacy transactions without a type require manifest recovery.');
  }
}
export function cwrAckSenderAllowed(recipient: string, sender: string): boolean {
  const allowed: Record<string, number[]> = { musicmark: [707, 10, 21, 101], the_mlc: [34], sesac: [71] };
  return allowed[recipient]?.includes(Number(sender)) ?? false;
}
/** Each society has its own projection; hub receipt never replaces society acceptance.
 * New revisions fence late responses. Same-revision competing batches require review. */
export function reconcileCwrOutcome(previous: CwrWorkOutcome | undefined, incoming: CwrWorkOutcome): CwrWorkOutcome {
  if (!previous) return incoming;
  if (incoming.revision < previous.revision) return previous;
  if (incoming.revision > previous.revision) return incoming;
  if (incoming.batchId !== previous.batchId) return { ...previous, outcome: 'review_required' };
  if (previous.independentlyVerified && !incoming.independentlyVerified) return previous;
  if (!previous.independentlyVerified && incoming.independentlyVerified) return incoming;
  if (incoming.processingDate < previous.processingDate) return previous;
  if (incoming.evidenceHash === previous.evidenceHash) return previous;
  // RA is intermediate, so a same-day AS/AC is normal progress, not a conflict.
  if (previous.status === 'RA' && ['AS', 'AC'].includes(incoming.status)) return incoming;
  if (previous.outcome === 'accepted' && ['RA', 'DU'].includes(incoming.status)
    && (!incoming.recipientWorkId || incoming.recipientWorkId === previous.recipientWorkId)) return previous;
  if (incoming.processingDate === previous.processingDate && incoming.status !== previous.status) return { ...incoming, outcome: 'review_required' };
  if (previous.outcome === 'accepted' && incoming.outcome === 'accepted' && previous.recipientWorkId === incoming.recipientWorkId) return incoming;
  return incoming;
}
