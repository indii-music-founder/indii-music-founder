import { describe, it, expect, vi, beforeEach } from 'vitest';

const renderStillMotion = vi.fn();

vi.mock('@/services/video/StillMotionRenderer', () => ({
    renderStillMotion: (...a: unknown[]) => renderStillMotion(...a),
    STILL_MOTION_RESOLUTIONS: {
        '9:16': { width: 1080, height: 1920 },
        '16:9': { width: 1920, height: 1080 },
        '4:5': { width: 1080, height: 1350 }
    }
}));

vi.mock('@/services/video/MotionPresets', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/services/video/MotionPresets')>();
    return { ...actual };
});

vi.mock('@/services/assets/AssetVersionService', () => ({
    AssetVersionService: { recordVersion: vi.fn(async (input: unknown) => ({ versionId: 'v_x', ...(input as object) })) }
}));

vi.mock('@/core/store', () => {
    const mockStore = { addToHistory: vi.fn(), currentProjectId: 'proj_1' };
    return { useStore: { getState: () => mockStore } };
});

import { VideoTools } from '../VideoTools';
import { AssetVersionService } from '@/services/assets/AssetVersionService';

const tool = (VideoTools as unknown as {
    animate_still: (args: {
        imageUrl: string;
        preset?: string;
        intensity?: number;
        resolution?: '9:16';
    }) => Promise<{ success: boolean; data: Record<string, unknown>; message: string }>;
}).animate_still;

describe('animate_still tool (E1.4)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        renderStillMotion.mockResolvedValue({
            status: 'completed',
            renderId: 'r1',
            asset: { url: 'file:///managed/clip.mp4', mimeType: 'video/mp4' }
        });
    });

    it('renders deterministically through the shared contract', async () => {
        const res = await tool({ imageUrl: 'https://cdn.test/still.png', preset: 'dolly-in' });

        expect(res.success).toBe(true);
        expect(res.data.deterministic).toBe(true);
        expect(res.data.preset).toBe('dolly-in');
        expect(renderStillMotion).toHaveBeenCalledWith(expect.objectContaining({
            stillUrl: 'https://cdn.test/still.png',
            preset: 'dolly-in',
            resolution: '9:16'
        }));
        expect(res.message).toContain('deterministic');
    });

    it('falls back to ken-burns for an unknown preset and validates resolution', async () => {
        await tool({ imageUrl: 'x.png', preset: 'warp-zoom' });
        expect(renderStillMotion).toHaveBeenCalledWith(expect.objectContaining({ preset: 'ken-burns' }));
    });

    it('records a motion_clip history item and an H1 version', async () => {
        await tool({ imageUrl: 'x.png', preset: 'pan-left' });

        const { addToHistory } = await import('@/core/store').then(m => (m.useStore.getState() as unknown as { addToHistory: ReturnType<typeof vi.fn> }));
        expect(addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            type: 'video',
            meta: expect.stringContaining('motion_clip')
        }));
        expect(AssetVersionService.recordVersion).toHaveBeenCalledWith(expect.objectContaining({
            parentVersionId: null,
            source: 'canvas-export'
        }));
    });

    it('fails closed on a missing imageUrl', async () => {
        const res = await tool({ imageUrl: '' });
        expect(res.success).toBe(false);
        expect(renderStillMotion).not.toHaveBeenCalled();
    });

    it('surfaces render failures as tool errors', async () => {
        renderStillMotion.mockRejectedValue(new Error('render worker offline'));
        const res = await tool({ imageUrl: 'x.png' });
        expect(res.success).toBe(false);
        expect(res.message).toContain('render worker offline');
    });
});
