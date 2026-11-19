import { describe, expect, it } from 'vitest';
import { validateBoardroomSteps, boardroomAddressedAgents, withAddressedBoardroomSteps, readyBoardroomSteps, receiptForBoardroomStep, formatBoardroomReceipt, isBoardroomCapabilityOnly, boardroomDependencyField, completedBoardroomToolResult, type BoardroomActionStep } from './BoardroomActionPlan';

// Pure scheduling and receipt interpretation; no accounts, provider mocks,
// persisted product data, or claims that a real customer action succeeded.
const first: BoardroomActionStep = { id: 'artwork', agentId: 'creative', task: 'Prepare artwork', dependencies: [] };
const next: BoardroomActionStep = { id: 'merch', agentId: 'merchandise', task: 'Use artwork', dependencies: ['artwork'] };

describe('Boardroom action ownership and evidence (structural only)', () => {
    it('reuses identical completed tool evidence across argument key ordering, while preserving distinct actions and retries', () => {
        const args = { presetId: 'cover_art_distributor', imageUri: 'attachment-0', focusX: 0.5 };
        const result = { success: true, data: { gallerySaved: true, versionRecorded: true } };
        const calls = [{ name: 'prepare_print_file', args, result }];
        expect(completedBoardroomToolResult('prepare_print_file', { focusX: 0.5, imageUri: 'attachment-0', presetId: 'cover_art_distributor' }, calls)).toBe(result);
        expect(completedBoardroomToolResult('prepare_print_file', { ...args, presetId: 'poster_11x17' }, calls)).toBeNull();
        for (const incomplete of [{ success: false }, { success: true, data: { status: 'queued' } }, { success: true, data: { versionRecorded: false } }]) {
            expect(completedBoardroomToolResult('prepare_print_file', args, [{ name: 'prepare_print_file', args, result: incomplete }])).toBeNull();
        }
        expect(completedBoardroomToolResult('prepare_print_file', args, [])).toBeNull();
    });
    it('reads only a leading address list of department names', () => {
        expect(boardroomAddressedAgents("Creative and Video, let's generate a marketing visual for this campaign.")).toEqual(['creative', 'video']);
        expect(boardroomAddressedAgents("Social and Publicist, let's outline the social copy.")).toEqual(['social', 'publicist']);
        expect(boardroomAddressedAgents('Creative Director, Road Manager & Finance: go.')).toEqual(['creative', 'road', 'finance']);
        expect(boardroomAddressedAgents('Legal, what templates are we using?')).toEqual(['legal']);
        // Domain words in the body, non-agent addressees and no address list do not count.
        expect(boardroomAddressedAgents("Let's generate a marketing visual, then a video.")).toEqual([]);
        expect(boardroomAddressedAgents('Thank you team, we are done for today.')).toEqual([]);
        expect(boardroomAddressedAgents('Marketing and my manager, sync up.')).toEqual([]);
        expect(boardroomAddressedAgents('Generate rollout materials and schedule drafts')).toEqual([]);
    });
    it('adds addressed specialists the router left out, but never rewrites Conductor-routed plans', () => {
        const routed: BoardroomActionStep[] = [{ id: 'step-0', agentId: 'creative', task: 'Make a visual', dependencies: [] }];
        expect(withAddressedBoardroomSteps(routed, ['creative', 'video'], 'Make a visual').map(step => step.agentId)).toEqual(['creative', 'video']);
        expect(withAddressedBoardroomSteps(routed, ['creative'], 'Make a visual')).toEqual(routed);
        const conductor: BoardroomActionStep[] = [{ id: 'step-0', agentId: 'generalist', task: "Marketing, you're excused", dependencies: [] }];
        expect(withAddressedBoardroomSteps(conductor, ['marketing'], "Marketing, you're excused")).toEqual(conductor);
        const merged = withAddressedBoardroomSteps(routed, ['video', 'social', 'music', 'brand', 'legal', 'finance'], 'Go');
        expect(merged).toHaveLength(6);
        expect(() => validateBoardroomSteps(merged)).not.toThrow();
    });
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
    it('keeps an interrupted dispatched action uncertain and blocks dependent work', () => {
        const receipt = receiptForBoardroomStep(first, { text: '', error: 'The operation was aborted' }, true);
        expect(receipt.status).toBe('uncertain');
        expect(readyBoardroomSteps([first, next], [receipt])).toEqual([]);
        expect(formatBoardroomReceipt(receipt)).toContain('Action outcome unknown; check its effect before retrying');
        expect(formatBoardroomReceipt(receipt)).not.toContain('Step failed');
    });
    it('does not erase completed actions when a later action awaits approval', () => {
        const receipt = receiptForBoardroomStep(first, {
            text: '',
            error: 'AWAITING_HUMAN_APPROVAL',
            toolCalls: [{ name: 'save_artwork', args: {}, result: { success: true, message: 'Artwork saved.' } }],
        });
        expect(receipt.status).toBe('pending');
        expect(formatBoardroomReceipt(receipt)).toContain('Artwork saved.');
        expect(formatBoardroomReceipt(receipt)).toContain('Review the pending request');
        expect(formatBoardroomReceipt(receipt)).not.toContain('The action has not run');
        expect(readyBoardroomSteps([first, next], [receipt])).toEqual([]);
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
