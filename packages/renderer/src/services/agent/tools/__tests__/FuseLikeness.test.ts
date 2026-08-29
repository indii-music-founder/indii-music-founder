import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/identity/LikenessFusionService', () => ({
    LikenessFusionService: {
        fuseLikeness: vi.fn(async (req: { targetDataUrl: string; maxAttempts?: number }) => {
            return {
                dataUrl: req.targetDataUrl,
                similarity: 0.61,
                passedThreshold: true,
                attempts: [{ dataUrl: req.targetDataUrl, similarity: 0.61 }]
            };
        })
    }
}));

vi.mock('@/core/store', () => {
    const mockStore = {
        addToHistory: vi.fn(),
        currentProjectId: 'proj_1',
        generatedHistory: [{ url: 'data:image/png;base64,SUBJECT' }],
        uploadedImages: []
    };
    return { useStore: { getState: () => mockStore } };
});

import { DirectorTools } from '../DirectorTools';
import { LikenessFusionService } from '@/services/identity/LikenessFusionService';

const tool = (DirectorTools as unknown as {
    fuse_likeness: (args: { targetImageIndex: number; headshotId?: string; maxAttempts?: number }) => Promise<{ success: boolean; data: Record<string, unknown>; message: string }>;
}).fuse_likeness;

describe('fuse_likeness tool (A1.4)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('resolves the indexed target and returns the similarity', async () => {
        const res = await tool({ targetImageIndex: 0 });

        expect(res.success).toBe(true);
        expect(res.data.similarity).toBeCloseTo(0.61, 10);
        expect(res.data.passedThreshold).toBe(true);
        expect(LikenessFusionService.fuseLikeness).toHaveBeenCalledWith(expect.objectContaining({
            targetDataUrl: 'data:image/png;base64,SUBJECT'
        }));

        const { addToHistory } = await import('@/core/store').then(m => (m.useStore.getState() as unknown as { addToHistory: ReturnType<typeof vi.fn> }));
        expect(addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            type: 'image',
            meta: expect.stringContaining('likeness_fusion')
        }));
    });

    it('fails closed on an invalid target index', async () => {
        const res = await tool({ targetImageIndex: 99 });
        expect(res.success).toBe(false);
        expect(LikenessFusionService.fuseLikeness).not.toHaveBeenCalled();
    });

    it('surfaces backend "not configured" errors honestly', async () => {
        (LikenessFusionService.fuseLikeness as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
            new Error('FacePipeline: no identity backend is configured.')
        );
        const res = await tool({ targetImageIndex: 0 });
        expect(res.success).toBe(false);
        expect(res.message).toContain('no identity backend is configured');
    });
});
