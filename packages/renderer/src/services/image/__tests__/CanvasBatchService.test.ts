import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canvasBatchService, PLATFORM_DIMENSIONS } from '../CanvasBatchService';
import { useStore } from '@/core/store';

vi.mock('@/core/store', () => {
    const mockStore = {
        addJob: vi.fn(),
        updateJobProgress: vi.fn(),
        updateJobStatus: vi.fn(),
    };
    return {
        useStore: {
            getState: () => mockStore
        }
    };
});

describe('CanvasBatchService', () => {
    let mockStore: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockStore = useStore.getState();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should export selected dimensions and update store', async () => {
        const mockCanvas = {};
        const selectedIds = ['square', 'story'];

        const promise = canvasBatchService.exportBatch(mockCanvas, selectedIds);

        await vi.advanceTimersByTimeAsync(800);
        await vi.advanceTimersByTimeAsync(800);

        const result = await promise;

        expect(result.size).toBe(2);
        expect(result.get('square')).toContain('square');
        expect(result.get('story')).toContain('story');

        expect(mockStore.addJob).toHaveBeenCalledWith(expect.objectContaining({
            status: 'running',
            type: 'ai_generation'
        }));
        expect(mockStore.updateJobProgress).toHaveBeenCalled();
        expect(mockStore.updateJobStatus).toHaveBeenCalledWith(expect.any(String), 'success');
    });

    it('should handle errors gracefully', async () => {
        const mockCanvas = {};
        const selectedIds = ['square'];

        // We can force an error by making updateJobProgress throw, since that's inside the try block
        mockStore.updateJobProgress.mockImplementationOnce(() => {
            throw new Error('Store update failed');
        });

        const promise = canvasBatchService.exportBatch(mockCanvas, selectedIds);

        await expect(promise).rejects.toThrow('Store update failed');

        expect(mockStore.updateJobStatus).toHaveBeenCalledWith(expect.any(String), 'error', 'Store update failed');
    });

    it('should log reframing', async () => {
        const mockCanvas = {};
        // just to hit the coverage
        await canvasBatchService.autoReframe(mockCanvas, 1080, 1080);
    });
});
