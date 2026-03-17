
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoUploadService } from './VideoUploadService';

// Mock the thumbnail generation — jsdom doesn't support <video> element events
vi.spyOn(VideoUploadService, 'generateAndUploadThumbnail').mockResolvedValue(undefined);

// Mock Firebase Storage
const mockUploadTask = {
    on: vi.fn(),
    snapshot: { ref: { parent: { fullPath: 'videos/testuser' } } },
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
};

vi.mock('firebase/storage', () => ({
    ref: vi.fn((_storage, path) => `ref://${path}`),
    uploadBytesResumable: vi.fn(() => mockUploadTask),
    uploadBytes: vi.fn(() => Promise.resolve()),
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
        warn: vi.fn(),
    },
}));

describe('VideoUploadService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-mock thumbnail generation after clearAllMocks
        vi.spyOn(VideoUploadService, 'generateAndUploadThumbnail').mockResolvedValue(undefined);
        // Reset upload task behavior for successful uploads by default
        mockUploadTask.on.mockImplementation((event, _progress, _error, complete) => {
            if (event === 'state_changed') {
                // Simulate immediate completion
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
        const result = await VideoUploadService.uploadVideo(file, 'videos/testuser/test.mp4');

        expect(result).toEqual({
            url: 'https://mock-url.com/video.mp4',
            path: 'videos/testuser/test.mp4',
            size: file.size,
            contentType: 'video/mp4',
            thumbnailUrl: undefined,
        });
    });

    it('should use long-term immutable cache headers', async () => {
        const file = new File([''], 'cached.mp4', { type: 'video/mp4' });
        await VideoUploadService.uploadVideo(file, 'videos/testuser/cached.mp4');

        const { uploadBytesResumable } = await import('firebase/storage');
        expect(uploadBytesResumable).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                contentType: 'video/mp4',
                cacheControl: 'public, max-age=31536000, immutable'
            })
        );
    });

    it('should enforce default content type if missing', async () => {
        const file = new File([''], 'unknown', { type: '' });
        await VideoUploadService.uploadVideo(file, 'videos/testuser/unknown');

        const { uploadBytesResumable } = await import('firebase/storage');
        expect(uploadBytesResumable).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({
                contentType: 'video/mp4',
            })
        );
    });

    it('should include generation metadata', async () => {
        const file = new File([''], 'meta.mp4', { type: 'video/mp4' });
        await VideoUploadService.uploadVideo(file, 'videos/testuser/meta.mp4');

        const { uploadBytesResumable } = await import('firebase/storage');
        const callArgs = (uploadBytesResumable as ReturnType<typeof vi.fn>).mock.calls[0][2];
        expect(callArgs.customMetadata).toHaveProperty('generatedAt');
        expect(callArgs.customMetadata.source).toBe('veo-pipeline');
    });

    it('should reject files over 500MB', () => {
        const bigFile = new File([''], 'big.mp4', { type: 'video/mp4' });
        Object.defineProperty(bigFile, 'size', { value: 600 * 1024 * 1024 });
        const error = VideoUploadService.validateVideo(bigFile);
        expect(error).toContain('File too large');
        expect(error).toContain('500MB');
    });

    it('should attempt thumbnail generation on upload', async () => {
        const file = new File(['content'], 'thumb.mp4', { type: 'video/mp4' });
        await VideoUploadService.uploadVideo(file, 'videos/testuser/thumb.mp4');

        expect(VideoUploadService.generateAndUploadThumbnail).toHaveBeenCalledWith(
            file,
            'videos/testuser/thumb.mp4',
            expect.anything()
        );
    });
});
