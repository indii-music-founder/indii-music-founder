import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ISSUE-994: PerformanceVideoService.renderVideo() previously sent `{ project }`
 * to the `renderVideo` callable (which requires `{ compositionId, inputProps:
 * { project } }` and rejects a bare `project` key), then read `response.data.videoUrl`
 * from a callable that only ever returns `{ success, renderId, message }` after
 * queueing an Inngest stitch job. These tests pin the corrected contract: the
 * right request shape, and polling the actual videoJobs/{renderId} doc via
 * waitForJob() for the real, terminal video URL instead of a field that never
 * existed on the callable's response.
 */

const mockAnalyzeAudio = vi.fn();
const mockRenderVideo = vi.fn();

vi.mock('firebase/functions', () => ({
    httpsCallable: (_functions: unknown, name: string) => {
        if (name === 'analyzeAudio') return mockAnalyzeAudio;
        if (name === 'renderVideo') return mockRenderVideo;
        throw new Error(`Unexpected callable requested in test: ${name}`);
    },
}));

vi.mock('@/services/firebase', () => ({
    functions: {},
    auth: { currentUser: { uid: 'user-1' } },
}));

const mockGenerateVideo = vi.fn();
const mockWaitForJob = vi.fn();

vi.mock('./VideoGenerationService', () => ({
    VideoGeneration: {
        generateVideo: (...args: unknown[]) => mockGenerateVideo(...args),
        waitForJob: (...args: unknown[]) => mockWaitForJob(...args),
    },
}));

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: {
        generateImages: vi.fn(),
    },
}));

import { performanceVideoService } from './PerformanceVideoService';

const SONIC_PROFILE = {
    bpm: 120,
    key: 'C major',
    mood: 'energetic',
    texture: 'layered',
    instrumentation: ['drums', 'synth'],
    vocalPresence: true,
    intensity: 0.8,
    genre: 'pop',
};

function baseOptions() {
    return {
        songUrl: 'https://cdn.example/song.mp3',
        masterAsset: {
            contentHash: 'a'.repeat(64),
            downloadUrl: 'https://storage.example/canonical-master.wav',
            masterFingerprint: 'SONIC-canonical-master',
            mimeType: 'audio/wav',
            originalFileName: 'master.wav',
            sizeBytes: 1234,
            storagePath: `masters/user-1/${'a'.repeat(64)}/original.wav`,
            uploadedAt: '2026-07-17T18:00:00.000Z',
        },
        isrc: 'USABC2600001',
        artistImageUrl: 'https://cdn.example/artist.png', // skips image-generation branch
        sceneCount: 1, // exactly one scene → exactly one generateVideo call
        aspectRatio: '16:9' as const,
    };
}

describe('PerformanceVideoService.generate (ISSUE-994)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAnalyzeAudio.mockResolvedValue({ data: SONIC_PROFILE });
        mockGenerateVideo.mockResolvedValue([{ id: 'clip-1', url: 'https://cdn.example/scene0.mp4' }]);
    });

    it('sends the request in the shape the callable actually requires', async () => {
        mockRenderVideo.mockResolvedValue({ data: { success: true, renderId: 'job-1', message: 'Render job queued.' } });
        mockWaitForJob.mockResolvedValue({ id: 'job-1', status: 'completed', videoUrl: 'https://cdn.example/final.mp4' });

        await performanceVideoService.generate(baseOptions());

        expect(mockRenderVideo).toHaveBeenCalledTimes(1);
        const [request] = mockRenderVideo.mock.calls[0]!;
        expect(request).toHaveProperty('compositionId');
        expect(typeof request.compositionId).toBe('string');
        expect(request.inputProps).toBeDefined();
        expect(request.inputProps.project).toBeDefined();
        expect(request.inputProps.project.clips).toBeInstanceOf(Array);
        // The old, broken shape must never be sent again.
        expect(request).not.toHaveProperty('project');
    });

    it('carries the canonical master identity into the audio timeline clip', async () => {
        mockRenderVideo.mockResolvedValue({ data: { success: true, renderId: 'job-1', message: 'Render job queued.' } });
        mockWaitForJob.mockResolvedValue({ id: 'job-1', status: 'completed', videoUrl: 'https://cdn.example/final.mp4' });

        await performanceVideoService.generate(baseOptions());

        const [request] = mockRenderVideo.mock.calls[0]!;
        const audioClip = request.inputProps.project.clips.find((clip: { type: string }) => clip.type === 'audio');
        expect(audioClip).toEqual(expect.objectContaining({
            src: 'https://storage.example/canonical-master.wav',
            masterFingerprint: 'SONIC-canonical-master',
            isrc: 'USABC2600001',
        }));
        expect(mockAnalyzeAudio).toHaveBeenCalledWith({
            audioUrl: 'https://storage.example/canonical-master.wav',
            mimeType: 'audio/wav',
        });
    });

    it('polls waitForJob for the real video URL instead of reading a field the callable never returns', async () => {
        mockRenderVideo.mockResolvedValue({ data: { success: true, renderId: 'job-1', message: 'Render job queued.' } });
        mockWaitForJob.mockResolvedValue({ id: 'job-1', status: 'completed', videoUrl: 'https://cdn.example/final.mp4' });

        const result = await performanceVideoService.generate(baseOptions());

        expect(mockWaitForJob).toHaveBeenCalledWith('job-1');
        expect(result.videoUrl).toBe('https://cdn.example/final.mp4');
    });

    it('reads the URL from output.url when videoUrl/url are absent', async () => {
        mockRenderVideo.mockResolvedValue({ data: { success: true, renderId: 'job-1', message: 'Render job queued.' } });
        mockWaitForJob.mockResolvedValue({ id: 'job-1', status: 'completed', output: { url: 'https://cdn.example/output-final.mp4' } });

        const result = await performanceVideoService.generate(baseOptions());

        expect(result.videoUrl).toBe('https://cdn.example/output-final.mp4');
    });

    it('throws instead of resolving when the render job could not be queued (no renderId)', async () => {
        mockRenderVideo.mockResolvedValue({ data: { success: false, renderId: '', message: 'Invalid project data. Missing tracks or clips.' } });

        await expect(performanceVideoService.generate(baseOptions())).rejects.toThrow('Invalid project data');
        expect(mockWaitForJob).not.toHaveBeenCalled();
    });

    it('throws instead of resolving when the completed job has no video URL at all', async () => {
        mockRenderVideo.mockResolvedValue({ data: { success: true, renderId: 'job-1', message: 'Render job queued.' } });
        mockWaitForJob.mockResolvedValue({ id: 'job-1', status: 'completed' });

        await expect(performanceVideoService.generate(baseOptions())).rejects.toThrow('without a video URL');
    });

    it('propagates a failed render job as a rejection rather than a false success', async () => {
        mockRenderVideo.mockResolvedValue({ data: { success: true, renderId: 'job-1', message: 'Render job queued.' } });
        mockWaitForJob.mockRejectedValue(new Error('Stitch failed: codec error'));

        await expect(performanceVideoService.generate(baseOptions())).rejects.toThrow('Stitch failed: codec error');
    });
});
