import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoryItem } from '@/core/types/history';
import { extractVideoFrame } from '@/utils/video';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';
import { CreativeStorageService } from './CreativeStorageService';
import { materializeVideoFrameForHandoff } from './CreativeMediaHandoffService';

vi.mock('@/utils/video', () => ({
    extractVideoFrame: vi.fn(),
}));

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: vi.fn(),
}));

vi.mock('./CreativeStorageService', () => ({
    CreativeStorageService: {
        uploadReferenceMedia: vi.fn(),
    },
}));

describe('materializeVideoFrameForHandoff', () => {
    const video: HistoryItem = {
        id: 'omni-job-1',
        type: 'video',
        url: 'https://storage.example/omni.mp4',
        storageUri: 'gs://bucket/creative/user/omni.mp4',
        prompt: 'Neon performance',
        timestamp: 1,
        projectId: 'project-1',
        origin: 'generated',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(extractVideoFrame).mockResolvedValue('data:image/jpeg;base64,FRAME');
        vi.mocked(CreativeStorageService.uploadReferenceMedia).mockResolvedValue('gs://bucket/creative/user/end-frame.jpg');
        vi.mocked(resolveStorageUrl).mockResolvedValue('https://storage.example/end-frame.jpg');
    });

    it('extracts, persists, and returns a durable image derived from the video', async () => {
        const frame = await materializeVideoFrameForHandoff(video, 'last', {
            userId: 'user-1',
            projectId: 'project-1',
        });

        expect(extractVideoFrame).toHaveBeenCalledWith(video.storageUri, 'last', { fps: 24 });
        expect(CreativeStorageService.uploadReferenceMedia).toHaveBeenCalledWith(
            'user-1',
            'data:image/jpeg;base64,FRAME',
            'image',
            { projectId: 'project-1', scope: 'assets' },
        );
        expect(frame).toEqual(expect.objectContaining({
            id: expect.stringMatching(/^omni-job-1-last-frame-/),
            type: 'image',
            url: 'https://storage.example/end-frame.jpg',
            storageUri: 'gs://bucket/creative/user/end-frame.jpg',
            parentId: 'omni-job-1',
            projectId: 'project-1',
        }));
    });

    it('rejects non-video inputs instead of uploading mislabeled media', async () => {
        await expect(materializeVideoFrameForHandoff(
            { ...video, type: 'image' },
            'first',
            { userId: 'user-1' },
        )).rejects.toThrow('Only video assets');
        expect(CreativeStorageService.uploadReferenceMedia).not.toHaveBeenCalled();
    });
});
