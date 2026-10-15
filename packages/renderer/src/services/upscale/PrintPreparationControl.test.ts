import { describe, expect, it } from 'vitest';
import { cancelledPrintResponse, finishedPrintResponse, printGalleryReference } from './PrintPreparationControl';
import { boardroomRequestedSourceId } from '@/services/agent/orchestration/BoardroomActionPlan';

// Pure request binding and terminal-receipt policy; no service or account doubles.
describe('Print request control', () => {
    it('does not let a cached reference shadow the same gallery original', () => {
        const references = [
            { id: 'portrait', alias: 'boardroom-asset-0', url: 'cached-preview' },
            { id: 'portrait', alias: 'gallery-10', url: 'gallery-reference' },
        ];
        expect(printGalleryReference('portrait', references)).toBe(references[1]);
        expect(printGalleryReference('new-upload', references)).toBeUndefined();
        expect(printGalleryReference('portrait', undefined)).toBeUndefined();
    });
    const sources = [
        { id: 'parent', alias: 'gallery-1', name: 'Polaroid dog artwork' },
        { id: 'portrait', alias: 'gallery-10', name: 'Polaroid dog artwork (9:16)' },
    ];
    it('binds the named variant rather than its shorter parent label', () => {
        expect(boardroomRequestedSourceId('Reuse “Polaroid dog artwork (9:16)” for a poster.', sources)).toBe('portrait');
    });
    it('honors an exact asset ID before overlapping labels', () => {
        expect(boardroomRequestedSourceId('Use imageUri portrait; the label is Polaroid dog artwork.', sources)).toBe('portrait');
    });
    it('does not confuse gallery-1 with gallery-10', () => {
        expect(boardroomRequestedSourceId('Prepare gallery-10.', sources)).toBe('portrait');
    });
    it('treats duplicate references to the same asset as one selection', () => {
        expect(boardroomRequestedSourceId('Use portrait.', [...sources, { ...sources[1]!, alias: 'boardroom-asset-1' }])).toBe('portrait');
    });
    it('leaves multiple or duplicate source choices unresolved', () => {
        expect(boardroomRequestedSourceId('Compare parent with portrait.', sources)).toBeUndefined();
        expect(boardroomRequestedSourceId('Use Polaroid dog artwork (9:16).', [...sources, { ...sources[1]!, id: 'duplicate' }])).toBeUndefined();
        expect(boardroomRequestedSourceId('Make a poster.', sources)).toBeUndefined();
    });
    it('ends a declined crop with the recorded failure and no invented output', () => {
        const result = { success: false, status: 'CANCELLED' as const, message: 'No print file was produced.', metadata: { errorCode: 'PRINT_CROP_CANCELLED' } };
        const calls = [{ name: 'prepare_print_file', args: { imageUri: 'portrait' }, result }];
        const response = cancelledPrintResponse('prepare_print_file', result, calls);
        expect(response).toEqual({ text: result.message, toolCalls: calls, error: 'PRINT_CROP_CANCELLED' });
        expect(response).not.toHaveProperty('urls');
    });
    it('keeps other failures retryable and requires the typed cancellation receipt', () => {
        for (const result of [
            { success: false, error: 'Network unavailable' },
            { success: false, status: 'CANCELLED' as const },
            { success: true, status: 'CANCELLED' as const, metadata: { errorCode: 'PRINT_CROP_CANCELLED' } },
        ]) expect(cancelledPrintResponse('prepare_print_file', result, [])).toBeNull();
        expect(cancelledPrintResponse('list_files', { success: false, status: 'CANCELLED', metadata: { errorCode: 'PRINT_CROP_CANCELLED' } }, [])).toBeNull();
    });
    it('ends a completed print step with its saved receipt before another model iteration', () => {
        const data = { fileCreated: true, gallerySaved: true, versionRecorded: true, assetId: 'saved-id', url: 'saved-original' };
        const result = { success: true, message: 'Print master saved.', data };
        const calls = [{ name: 'prepare_print_file', args: {}, result }];
        expect(finishedPrintResponse('prepare_print_file', result, calls)).toEqual({ text: result.message, data, toolCalls: calls });
        for (const patch of [{ fileCreated: false }, { url: '' }, { assetId: '' }]) {
            expect(finishedPrintResponse('prepare_print_file', { ...result, data: { ...data, ...patch } }, calls)).toBeNull();
        }
        expect(finishedPrintResponse('prepare_print_file', { ...result, status: 'EXECUTING' }, calls)).toBeNull();
        expect(finishedPrintResponse('prepare_print_file', { ...result, data: { ...data, status: 'QUEUED' } }, calls)).toBeNull();
        expect(finishedPrintResponse('prepare_print_file', { ...result, success: false }, calls)).toBeNull();
        expect(finishedPrintResponse('list_files', result, calls)).toBeNull();
    });

    it('reports a created file with failed persistence without another preparation', () => {
        for (const data of [
            { fileCreated: true, gallerySaved: true, versionRecorded: false, assetId: 'saved-id', url: 'saved-original' },
            { fileCreated: true, gallerySaved: false, versionRecorded: false, assetId: 'unsaved-id' },
        ]) {
            const result = { success: true, message: 'Print file created; persistence incomplete.', data };
            const calls = [{ name: 'prepare_print_file', args: {}, result }];
            expect(finishedPrintResponse('prepare_print_file', result, calls)).toEqual({ text: result.message, data, toolCalls: calls });
        }
    });

});
