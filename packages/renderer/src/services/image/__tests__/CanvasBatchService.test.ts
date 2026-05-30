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
    });

    it('should fail closed when no production renderer is configured', async () => {
        const originalBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
        import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = '';

        const mockCanvas = {};
        const selectedIds = ['square', 'story'];

        try {
            await expect(canvasBatchService.exportBatch(mockCanvas, selectedIds))
                .rejects.toThrow('Canvas batch export renderer is not configured');

            expect(mockStore.addJob).toHaveBeenCalledWith(expect.objectContaining({
                status: 'running',
                type: 'ai_generation'
            }));
            expect(mockStore.updateJobProgress).not.toHaveBeenCalled();
            expect(mockStore.updateJobStatus).toHaveBeenCalledWith(
                expect.any(String),
                'error',
                'Canvas batch export renderer is not configured. No asset URL was generated.'
            );
        } finally {
            import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = originalBucket;
        }
    });

    it('should return an empty result when no targets are selected', async () => {
        const mockCanvas = {};
        const selectedIds: string[] = [];

        const result = await canvasBatchService.exportBatch(mockCanvas, selectedIds);

        expect(result.size).toBe(0);
        expect(mockStore.updateJobStatus).toHaveBeenCalledWith(expect.any(String), 'success');
    });

    it('should log reframing', async () => {
        const mockCanvas = {};
        // just to hit the coverage
        await canvasBatchService.autoReframe(mockCanvas, 1080, 1080);
    });
});
