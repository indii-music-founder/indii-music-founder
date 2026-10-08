import { describe, expect, it } from 'vitest';
import { getDurableReportReceipt } from './durableReportReceipt';

// Pure control-flow classification, not proof of a live filing or service path.
describe('durable reporting batch receipt (structural only)', () => {
    const receipt = { success: true, metadata: { durableReceipt: true, receiptText: 'Saved report receipt' } };
    it('finishes a reporting-only batch and preserves every receipt', () => {
        expect(getDurableReportReceipt([{ name: 'report_bug', result: receipt },
            { name: 'report_bug', result: { ...receipt, metadata: { ...receipt.metadata, receiptText: 'Second receipt' } } }]))
            .toBe('Saved report receipt\n\nSecond receipt');
    });
    it('continues mixed batches and failures instead of abandoning work', () => {
        expect(getDurableReportReceipt([{ name: 'report_bug', result: receipt }, { name: 'other', result: receipt }])).toBeUndefined();
        expect(getDurableReportReceipt([{ name: 'report_bug', result: { ...receipt, success: false } }])).toBeUndefined();
        expect(getDurableReportReceipt([{ name: 'report_bug', result: { success: true } }])).toBeUndefined();
        expect(getDurableReportReceipt([])).toBeUndefined();
    });
});
