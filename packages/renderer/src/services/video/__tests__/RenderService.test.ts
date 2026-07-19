import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenderService } from '../RenderService';
import { renderMedia } from '@remotion/renderer';

// Mock @remotion/renderer
vi.mock('@remotion/renderer', () => ({
    renderMedia: vi.fn(),
}));

describe('RenderService', () => {
    let service: RenderService;

    beforeEach(() => {
        service = new RenderService();
        vi.clearAllMocks();
    });

    it('should call renderMedia with correct parameters', async () => {
        const config = {
            compositionId: 'TestComp',
            outputLocation: '/tmp/output.mp4',
            inputProps: { text: 'Hello' },
            codec: 'h264' as const,
        };

        (renderMedia as import("vitest").Mock).mockResolvedValue(undefined);

        const result = await service.renderComposition(config);

        expect(renderMedia).toHaveBeenCalledWith(expect.objectContaining({
            composition: expect.objectContaining({
                id: 'TestComp',
                props: { text: 'Hello' },
                width: 1920,
                height: 1080,
            }),
            outputLocation: '/tmp/output.mp4',
            codec: 'h264',
        }));

        expect(result).toBe('/tmp/output.mp4');
    });

    it('should throw error when renderMedia fails', async () => {
        const config = {
            compositionId: 'FailComp',
            outputLocation: '/tmp/fail.mp4',
            inputProps: {},
        };

        (renderMedia as import("vitest").Mock).mockRejectedValue(new Error('Render error'));

        await expect(service.renderComposition(config)).rejects.toThrow('Failed to render composition: Render error');
    });

    /**
     * ISSUE-995: a Cloud Run render with no public URL yet was previously
     * encoded as a `CLOUD_QUEUED:...` string and callers displayed it as a
     * "shareable URL". It must now come back as a typed queued result that
     * cannot be mistaken for a real link.
     */
    describe('renderComposition cloud queue (ISSUE-995)', () => {
        it('returns a real string URL when Cloud Run reports one', async () => {
            vi.spyOn(service, 'renderCompositionCloud').mockResolvedValue({
                renderId: 'render-1',
                bucketName: 'bucket-1',
                publicUrl: 'https://storage.googleapis.com/bucket-1/render-1.mp4',
            });

            const result = await service.renderComposition({
                compositionId: 'Showreel',
                outputLocation: 'ignored.mp4',
                inputProps: {},
                useCloudQueue: true,
            });

            expect(result).toBe('https://storage.googleapis.com/bucket-1/render-1.mp4');
        });

        it('returns a typed queued result (not a fake URL) when no public URL exists yet', async () => {
            vi.spyOn(service, 'renderCompositionCloud').mockResolvedValue({
                renderId: 'render-2',
                bucketName: 'bucket-2',
            });

            const result = await service.renderComposition({
                compositionId: 'Showreel',
                outputLocation: 'ignored.mp4',
                inputProps: {},
                useCloudQueue: true,
            });

            expect(result).toEqual({ status: 'queued', renderId: 'render-2', bucketName: 'bucket-2' });
            expect(typeof result).not.toBe('string');
        });
    });
});
