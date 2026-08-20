import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { renderMedia } from '@remotion/renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RenderService } from '../RenderService';

vi.mock('@remotion/renderer', () => ({
    renderMedia: vi.fn(),
}));

const privateConfig = {
    compositionId: 'Showreel',
    outputLocation: 'ignored.mp4',
    projectId: 'project-1',
    organizationId: 'org-1',
    inputProps: { project: { id: 'project-1' } },
    useCloudQueue: true,
};

describe('RenderService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps the local renderer contract unchanged', async () => {
        (renderMedia as import('vitest').Mock).mockResolvedValue(undefined);
        const service = new RenderService();

        const result = await service.renderComposition({
            compositionId: 'TestComp',
            outputLocation: '/tmp/output.mp4',
            inputProps: { text: 'Hello' },
            codec: 'h264',
        });

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

    it('queues only through the authenticated server authority with fixed private policy', async () => {
        const call = vi.fn().mockResolvedValue({
            success: true,
            renderId: 'render-1',
            message: 'Render job queued.',
        });
        const service = new RenderService(call);

        await expect(service.queueComposition(privateConfig)).resolves.toEqual({
            status: 'queued',
            renderId: 'render-1',
            projectId: 'project-1',
            progress: 0,
        });
        expect(call).toHaveBeenCalledWith('renderVideo', {
            compositionId: 'Showreel',
            accessPolicy: 'private-project-render.v1',
            projectId: 'project-1',
            organizationId: 'org-1',
            inputProps: privateConfig.inputProps,
        });
    });

    it('fails closed before dispatch without project and organization identity', async () => {
        const call = vi.fn();
        const service = new RenderService(call);
        await expect(service.queueComposition({
            ...privateConfig,
            organizationId: undefined,
        })).rejects.toThrow('organizationId is required');
        expect(call).not.toHaveBeenCalled();
    });

    it('reports queued/running/completed receipts and exposes a URL only at completion', async () => {
        const expiresAt = Date.now() + 5 * 60 * 1000;
        const call = vi.fn()
            .mockResolvedValueOnce({
                status: 'queued',
                renderId: 'render-1',
                projectId: 'project-1',
                progress: 0,
            })
            .mockResolvedValueOnce({
                status: 'running',
                renderId: 'render-1',
                projectId: 'project-1',
                progress: 60,
                phase: 'mapping_canonical_master',
            })
            .mockResolvedValueOnce({
                status: 'completed',
                renderId: 'render-1',
                projectId: 'project-1',
                progress: 100,
                asset: {
                    url: 'https://signed.example/private-output',
                    expiresAt,
                    generation: '123456789',
                    mimeType: 'video/mp4',
                },
            });
        const wait = vi.fn().mockResolvedValue(undefined);
        const service = new RenderService(call, wait, () => Date.now());
        const receipts: unknown[] = [];

        const completed = await service.waitForRender(
            'render-1',
            receipt => receipts.push(receipt),
            { pollIntervalMs: 1, timeoutMs: 1_000 },
        );

        expect(receipts.slice(0, 2)).toEqual([
            expect.not.objectContaining({ asset: expect.anything() }),
            expect.not.objectContaining({ asset: expect.anything() }),
        ]);
        expect(completed).toEqual(expect.objectContaining({
            status: 'completed',
            asset: expect.objectContaining({ url: 'https://signed.example/private-output' }),
        }));
        expect(call).toHaveBeenCalledTimes(3);
        expect(call).toHaveBeenCalledWith('getVideoRenderReceipt', { jobId: 'render-1' });
    });

    it('does not fabricate an asset when the server reports failure', async () => {
        const service = new RenderService(vi.fn().mockResolvedValue({
            status: 'failed',
            renderId: 'render-1',
            projectId: 'project-1',
            progress: 44,
            error: 'Render failed.',
        }));
        const receipts: unknown[] = [];

        await expect(service.waitForRender('render-1', receipt => receipts.push(receipt)))
            .rejects.toThrow('Render failed.');
        expect(receipts).toEqual([
            expect.objectContaining({ status: 'failed' }),
        ]);
        expect(receipts[0]).not.toEqual(expect.objectContaining({ asset: expect.anything() }));
    });

    it('contains no renderer Cloud Run client authority, public privacy, or fabricated fallback', async () => {
        // Resolve relative to THIS file (src/services/video/__tests__), so the
        // suite behaves identically from the repo root and from the renderer
        // package directory.
        const files = await Promise.all([
            readFile(resolve(__dirname, '../RenderService.ts'), 'utf8'),
            readFile(resolve(__dirname, '../ParallelRenderOrchestrator.ts'), 'utf8'),
            readFile(resolve(__dirname, '../VeoToRemotionBridge.ts'), 'utf8'),
            // __tests__ → video → services → src → packages/renderer
            readFile(resolve(__dirname, '../../../../vite.config.ts'), 'utf8'),
            // …→ packages/renderer → packages → repo root
            readFile(resolve(__dirname, '../../../../../..', 'electron.vite.config.ts'), 'utf8'),
        ]);
        const rendererAuthority = files.join('\n');

        expect(rendererAuthority).not.toContain('@remotion/cloudrun/client');
        expect(rendererAuthority).not.toMatch(/privacy\s*:\s*['"]public['"]/);
        expect(rendererAuthority).not.toContain('storage.googleapis.com/indii-renders');
        expect(rendererAuthority).not.toContain('RemotionCloudRunConfig');
    });
});
