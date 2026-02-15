
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoUploadService } from './VideoUploadService';

// Mock Firebase Storage
const mockUploadTask = {
    on: vi.fn(),
    snapshot: { ref: 'mock-ref' },
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
};

vi.mock('firebase/storage', () => ({
    ref: vi.fn((storage, path) => `ref://${path}`),
    uploadBytesResumable: vi.fn(() => mockUploadTask),
    getDownloadURL: vi.fn(() => Promise.resolve('https://mock-url.com/video.mp4')),
    StorageError: class extends Error { },
}));

vi.mock('../firebase', () => ({
    storage: {},
}));

vi.mock('@/core/logger/Logger', () => ({
    Logger: {
        info: vi.fn(),
        error: vi.fn(),
    },
}));

describe('VideoUploadService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset upload task behavior for successful uploads by default
        mockUploadTask.on.mockImplementation((event, progress, error, complete) => {
            if (event === 'state_changed') {
                // Simulate complete
                if (complete) complete();
            }
            return () => { }; // Unsubscribe
        });
    });

    it('should validate valid video files', () => {
        const file = new File([''], 'video.mp4', { type: 'video/mp4' });
        expect(VideoUploadService.validateVideo(file)).toBeNull();
    });

    it('should reject invalid file types', () => {
        const file = new File([''], 'image.png', { type: 'image/png' });
        expect(VideoUploadService.validateVideo(file)).toContain('not a valid video');
    });

    it('should upload video and return result', async () => {
        const file = new File(['mock-content'], 'test.mp4', { type: 'video/mp4' });
        const result = await VideoUploadService.uploadVideo(file, 'videos/test.mp4');

        expect(result).toEqual({
            url: 'https://mock-url.com/video.mp4',
            path: 'videos/test.mp4',
            size: file.size,
            contentType: 'video/mp4'
        });
    });

    it('should enforce default content type if missing', async () => {
        const file = new File([''], 'unknown', { type: '' });
        // Start the upload
        const promise = VideoUploadService.uploadVideo(file, 'videos/unknown');

        // Wait for it
        await promise;

        const { uploadBytesResumable } = await import('firebase/storage');
        // Check the metadata passed to uploadBytesResumable
        expect(uploadBytesResumable).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                contentType: 'video/mp4',
                cacheControl: 'public, max-age=3600'
            })
        );
    });
});
