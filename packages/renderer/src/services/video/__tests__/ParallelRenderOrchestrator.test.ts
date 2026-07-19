import { describe, it, expect, vi } from 'vitest';
import { ParallelRenderOrchestrator } from '../ParallelRenderOrchestrator';
import { renderService } from '../RenderService';

// Mock the dependencies
vi.mock('@/modules/creative/video/store/videoEditorStore', () => {
    const mockStore = {
        project: {
            id: 'proj-1',
            fps: 30,
            durationInFrames: 1800 // 60 seconds
        }
    };
    return {
        useVideoEditorStore: {
            getState: () => mockStore
        }
    };
});

vi.mock('../RenderService', () => {
    return {
        renderService: {
            renderCompositionCloud: vi.fn().mockResolvedValue({
                renderId: 'render-mock',
                bucketName: 'mock-bucket',
                publicUrl: 'https://storage.googleapis.com/chunk_mock.mp4'
            })
        }
    };
});

describe('ParallelRenderOrchestrator', () => {
    it('should split composition into parallel segments and generate valid FFmpeg stitch scripts', async () => {
        const progressEvents: number[] = [];
        const result = await ParallelRenderOrchestrator.renderLongFormParallel({
            projectId: 'proj-1',
            compositionId: 'MyComp',
            segmentDurationSeconds: 30,
            audioTrackUrl: 'https://example.com/song.mp3'
        }, (pct) => {
            progressEvents.push(pct);
        });

        expect(renderService.renderCompositionCloud).toHaveBeenCalledTimes(2); // 60s total / 30s segments = 2 chunks
        // ISSUE-885: no fabricated stitched URL — chunks + real stitch command only
        expect(result.status).toBe('chunks_ready');
        expect(result.chunkUrls).toHaveLength(2);
        expect(result.chunkUrls[0]).toBe('https://storage.googleapis.com/chunk_mock.mp4');
        expect(result.ffmpegStitchCommand).toContain('ffmpeg -f concat');
        expect(result.ffmpegStitchCommand).toContain('-i "https://example.com/song.mp3"');
    });
});
