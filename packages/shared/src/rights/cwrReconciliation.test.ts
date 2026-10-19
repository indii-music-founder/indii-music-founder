import { describe, it, expect } from 'vitest';
import { correlateCwrAck, cwrAckOutcome, cwrAckSenderAllowed, reconcileCwrOutcome, type CwrWorkOutcome } from './cwrReconciliation';
import type { CwrAcknowledgment } from './cwr';
const ack: CwrAcknowledgment = { originalDate: '20261012', originalTime: '143000', group: 1, transaction: 0, type: 'NWR', workId: 'WORK1', recipientWorkId: '123', processingDate: '20261013', status: 'AS', messages: [] };
const outcome: CwrWorkOutcome = { revision: 2, batchId: 'B2', workId: 'WORK1', sender: '034', processingDate: '20261013', status: 'AS', outcome: 'accepted', recipientWorkId: '123', source: 'receiver_transport', independentlyVerified: true, evidenceHash: 'hash1' };
describe('CWR correlation and revision fences (structural protocol tests)', () => {
  it('keeps hub receipt separate from society acceptance', () => {
    expect(cwrAckOutcome(ack, '000000707')).toBe('received');
    expect(cwrAckOutcome(ack, '000000034')).toBe('accepted');
    expect(cwrAckOutcome({ ...ack, recipientWorkId: '' }, '034')).toBe('review_required');
    expect(cwrAckOutcome({ ...ack, status: 'RA' }, '034')).toBe('processing');
    expect(cwrAckOutcome({ ...ack, status: 'ZZ' }, '034')).toBe('review_required');
    expect(cwrAckSenderAllowed('musicmark', '000000010')).toBe(true);
    expect(cwrAckSenderAllowed('musicmark', '000000071')).toBe(false);
    expect(cwrAckSenderAllowed('the_mlc', '000000707')).toBe(false);
  });
  it('requires exact type, identity and original timestamp', () => {
    const tx = { group: 1, transaction: 0, type: 'NWR' as const, workId: 'WORK1', revision: 1 };
    expect(() => correlateCwrAck(ack, tx, '2026-10-12T14:30:00.000Z')).not.toThrow();
    for (const change of [{ type: 'REV' as const }, { workId: 'OTHER' }, { transaction: 1 }, { group: 2 }]) expect(() => correlateCwrAck(ack, { ...tx, ...change }, '2026-10-12T14:30:00.000Z')).toThrow('correlated');
    expect(() => correlateCwrAck(ack, tx, '2026-10-12T14:30:01.000Z')).toThrow('correlated');
  });
  it('fences late revisions, dates, competing batches and contradictory same-day outcomes', () => {
    expect(reconcileCwrOutcome(outcome, { ...outcome, revision: 1, status: 'RJ' })).toBe(outcome);
    expect(reconcileCwrOutcome(outcome, { ...outcome, evidenceHash: 'other', processingDate: '20261012' })).toBe(outcome);
    expect(reconcileCwrOutcome(outcome, { ...outcome, batchId: 'OTHER' }).outcome).toBe('review_required');
    expect(reconcileCwrOutcome(outcome, { ...outcome, evidenceHash: 'other', status: 'RJ' }).outcome).toBe('review_required');
    expect(reconcileCwrOutcome(outcome, { ...outcome, revision: 3, batchId: 'B3' }).revision).toBe(3);
  });
  it('advances intermediate RA to same-day acceptance without later RA/duplicate downgrades', () => {
    const processing = { ...outcome, status: 'RA', outcome: 'processing' as const, recipientWorkId: '', evidenceHash: 'initial' };
    expect(reconcileCwrOutcome(processing, outcome)).toBe(outcome);
    expect(reconcileCwrOutcome(outcome, { ...processing, processingDate: '20261014' })).toBe(outcome);
    expect(reconcileCwrOutcome(outcome, { ...processing, status: 'DU' })).toBe(outcome);
    expect(reconcileCwrOutcome({ ...outcome, independentlyVerified: false, source: 'user_import' }, processing)).toBe(processing);
  });
  it('deduplicates evidence while allowing identical bytes fetched from the receiver to upgrade provenance', () => {
    const reported = { ...outcome, independentlyVerified: false, source: 'user_import' as const };
    expect(reconcileCwrOutcome(reported, outcome)).toBe(outcome);
    expect(reconcileCwrOutcome(outcome, reported)).toBe(outcome);
    expect(reconcileCwrOutcome(outcome, { ...reported, evidenceHash: 'other', processingDate: '20261014' })).toBe(outcome);
  });
});
