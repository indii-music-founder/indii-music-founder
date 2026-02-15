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

        (renderMedia as any).mockResolvedValue(undefined);

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

        (renderMedia as any).mockRejectedValue(new Error('Render error'));

        await expect(service.renderComposition(config)).rejects.toThrow('Failed to render composition: Render error');
    });
});
