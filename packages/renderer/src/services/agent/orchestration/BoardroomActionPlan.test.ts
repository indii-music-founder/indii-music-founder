import { describe, expect, it } from 'vitest';
import { validateBoardroomSteps, readyBoardroomSteps, receiptForBoardroomStep, formatBoardroomReceipt, isBoardroomCapabilityOnly, boardroomDependencyField, type BoardroomActionStep } from './BoardroomActionPlan';

// Pure scheduling and receipt interpretation; no accounts, provider mocks,
// persisted product data, or claims that a real customer action succeeded.
const first: BoardroomActionStep = { id: 'artwork', agentId: 'creative', task: 'Prepare artwork', dependencies: [] };
const next: BoardroomActionStep = { id: 'merch', agentId: 'merchandise', task: 'Use artwork', dependencies: ['artwork'] };

describe('Boardroom action ownership and evidence (structural only)', () => {
    it('keeps polite creation requests on the intent-routing path', () => {
        expect(isBoardroomCapabilityOnly('Can you make an image?')).toBe(false);
        expect(isBoardroomCapabilityOnly('Could you create a video?')).toBe(false);
        expect(isBoardroomCapabilityOnly('What can you do?')).toBe(true);
        expect(isBoardroomCapabilityOnly('Reuse my upload and prepare 3000x3000 PNG at 300 DPI.')).toBe(false);
    });
    it('rejects cycles, duplicate IDs, missing dependencies, and cross-tier assignments', () => {
        expect(() => validateBoardroomSteps([first, { ...next, id: 'artwork' }])).toThrow('unique');
        expect(() => validateBoardroomSteps([{ ...first, dependencies: ['merch'] }, next])).toThrow('cycle');
        expect(() => validateBoardroomSteps([{ ...first, dependencies: ['missing'] }])).toThrow('dependency');
        expect(() => validateBoardroomSteps([{ ...first, agentId: 'finance.tax' }])).toThrow('department owner');
    });
    it('dispatches a dependency only once and only after the upstream result', () => {
        expect(readyBoardroomSteps([first, next], [])).toEqual([first]);
        const receipt = receiptForBoardroomStep(first, { text: '', toolCalls: [{ name: 'pure_calculation', args: {}, result: { success: true } }] });
        expect(readyBoardroomSteps([first, next], [receipt])).toEqual([next]);
        expect(readyBoardroomSteps([first, next], [receipt, receiptForBoardroomStep(next, { text: 'Written response' })])).toEqual([]);
    });
    it('blocks dependent work on queued, failed, approval-pending, and partial results', () => {
        for (const result of [{ success: true, data: { status: 'queued' } }, { success: false }, { success: true, status: 'AWAITING_HUMAN' as const },
            { success: true, data: { gallerySaved: false } }]) {
            const receipt = receiptForBoardroomStep(first, { text: 'Completed everything', toolCalls: [{ name: 'receipt', args: {}, result }] });
            expect(readyBoardroomSteps([first, next], [receipt])).toEqual([]);
        }
    });
    it('does not treat a prose success claim or an opaque tool result as verified execution', () => {
        expect(receiptForBoardroomStep(first, { text: 'All files saved' }).status).toBe('response');
        expect(receiptForBoardroomStep(first, { text: 'Done', toolCalls: [{ name: 'receipt', args: {}, result: 'unstructured success' }] }).status).toBe('failed');
    });
    it('preserves file creation separately from version-recording failure and limits diagnostic disclosure', () => {
        const receipt = receiptForBoardroomStep(first, { text: 'Everything succeeded', toolCalls: [
            { name: 'prepare_print_file', args: {}, result: { success: true, message: 'Created 3000x3000 PNG at 300 DPI.', data: { versionRecorded: false } } },
            { name: 'record_asset_version', args: {}, result: { success: false, error: 'Internal database detail' } },
        ] });
        expect(receipt.status).toBe('partial');
        expect(formatBoardroomReceipt(receipt)).toContain('Created 3000x3000 PNG');
        expect(formatBoardroomReceipt(receipt)).not.toContain('Everything succeeded');
        expect(formatBoardroomReceipt(receipt)).not.toContain('Internal database detail');
        expect(formatBoardroomReceipt(receipt, true)).toContain('Internal database detail');
    });
    it('passes actual tool fields to dependent steps and does not traverse prototypes', () => {
        const response = { text: 'A prose summary', toolCalls: [{ name: 'receipt', args: {}, result: { success: true, data: { width: 3000, height: 3000, dpi: 300 } } }] };
        expect(boardroomDependencyField(response, 'data.width')).toBe(3000);
        expect(boardroomDependencyField(response, 'data.missing')).toBeUndefined();
        expect(boardroomDependencyField(response, 'data.constructor')).toBeUndefined();
    });
});
