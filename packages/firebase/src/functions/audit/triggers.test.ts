import { describe, expect, it } from 'vitest';
import { buildAnalysisReceiptEvents } from './triggers.js';

const COMPLETE_RECEIPT = {
    status: 'complete',
    userId: 'user-1',
    contentHash: 'a'.repeat(64),
    storagePath: 'users/user-1/masters/' + 'a'.repeat(64) + '/original.wav',
    generation: '17273000000000000',
    masterFingerprint: 'fp-1',
};

describe('buildAnalysisReceiptEvents (receipt completion fan-out)', () => {
    it('fans out to BOTH the audit worker and the ingestion runbook', () => {
        const events = buildAnalysisReceiptEvents('receipt-1', COMPLETE_RECEIPT);
        expect(events.map((event) => event.name)).toEqual(['admin/audit.requested', 'admin/master.analyzed']);

        const [audit, runbook] = events;
        expect(audit.data).toMatchObject({ userId: 'user-1', entityType: 'master', entityRefs: { masterHash: 'a'.repeat(64) }, receiptId: 'receipt-1' });
        expect(runbook.data).toMatchObject({
            userId: 'user-1',
            masterHash: 'a'.repeat(64),
            receiptId: 'receipt-1',
            storagePath: COMPLETE_RECEIPT.storagePath,
            generation: '17273000000000000',
            masterFingerprint: 'fp-1',
        });
        expect(events.every((event) => event.user.id === 'user-1')).toBe(true);
    });

    it('emits nothing for non-complete receipts or identity-less documents', () => {
        expect(buildAnalysisReceiptEvents('r', { ...COMPLETE_RECEIPT, status: 'processing' })).toEqual([]);
        expect(buildAnalysisReceiptEvents('r', { status: 'complete' })).toEqual([]);
        expect(buildAnalysisReceiptEvents('r', {})).toEqual([]);
    });

    it('still fans out the audit event when the storage path is absent', () => {
        const events = buildAnalysisReceiptEvents('r', { status: 'complete', userId: 'u', contentHash: 'a'.repeat(64) });
        expect(events.map((event) => event.name)).toEqual(['admin/audit.requested']);
    });
});
