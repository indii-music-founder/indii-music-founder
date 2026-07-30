import { describe, expect, it } from 'vitest';

import { ParallelRenderOrchestrator } from '../ParallelRenderOrchestrator';

describe('ParallelRenderOrchestrator', () => {
    it('fails closed with a typed unsupported receipt and no fabricated URLs', async () => {
        const progress: number[] = [];
        const result = await ParallelRenderOrchestrator.renderLongFormParallel({
            projectId: 'project-1',
            compositionId: 'Showreel',
            segmentDurationSeconds: 30,
            audioTrackUrl: 'gs://bucket/masters/owner/master.wav',
        }, value => progress.push(value));

        expect(result).toEqual({
            status: 'unsupported',
            code: 'PRIVATE_PARALLEL_RENDER_NOT_IMPLEMENTED',
            message: expect.stringContaining('server-owned chunk and stitch receipts'),
        });
        expect(progress).toEqual([]);
        expect(result).not.toEqual(expect.objectContaining({
            chunkUrls: expect.anything(),
            ffmpegStitchCommand: expect.anything(),
        }));
    });
});
