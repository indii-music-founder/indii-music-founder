import type { ToolFunctionResult } from '../types';

/** A reporting-only tool batch is complete when every report has a durable receipt. */
export function getDurableReportReceipt(
    calls: ReadonlyArray<{ name: string; result: ToolFunctionResult | string }>,
): string | undefined {
    if (!calls.length || calls.some(call => call.name !== 'report_bug')) return undefined;
    const receipts: string[] = [];
    for (const call of calls) {
        if (typeof call.result === 'string' || call.result.success !== true ||
            call.result.metadata?.durableReceipt !== true ||
            typeof call.result.metadata.receiptText !== 'string' ||
            !call.result.metadata.receiptText.trim()) return undefined;
        receipts.push(call.result.metadata.receiptText);
    }
    return receipts.join('\n\n');
}
