import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhiteGloveIngestionService } from './WhiteGloveIngestionService';

// We need to mock firebase storage
vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(),
    ref: vi.fn(),
    uploadBytesResumable: vi.fn(() => ({
        on: vi.fn()
    }))
}));

// Mock useStore
let mockUploadQueue: any[] = [];
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            uploadQueue: mockUploadQueue,
            addUploadItems: (items: any[]) => {
                mockUploadQueue.push(...items);
            },
            updateUploadProgress: vi.fn(),
            updateUploadStatus: vi.fn()
        })
    }
}));

describe('WhiteGloveIngestionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUploadQueue = [];
    });

    it('should enqueue an asset, update the queue slice, and return an uploadId', async () => {
        // Arrange
        const mockFile = new File(['dummy content'], 'master_track.wav', { type: 'audio/wav' });
        const mockArtistId = 'artist_123';
        
        // Act
        const uploadId = await WhiteGloveIngestionService.enqueueAsset(mockFile, 'audio', mockArtistId);

        // Assert
        expect(uploadId).toBeDefined();
        expect(typeof uploadId).toBe('string');
        
        // Ensure it interacts with the underlying upload mechanism
        // Ensure it interacts with the underlying upload mechanism
        // We'll verify this based on how the store/Firebase gets called.
        // For the tracer bullet, just getting an ID and ensuring it didn't throw is the first step.
    });

    it('should initiate a Firebase resumable upload with the correct path', async () => {
        const mockFile = new File(['dummy content'], 'master_track.wav', { type: 'audio/wav' });
        const mockArtistId = 'artist_123';
        const { uploadBytesResumable, ref } = await import('firebase/storage');
        
        await WhiteGloveIngestionService.enqueueAsset(mockFile, 'audio', mockArtistId);
        
        expect(ref).toHaveBeenCalledWith(undefined, `ingest/white-glove/${mockArtistId}/audio/master_track.wav`);
        expect(uploadBytesResumable).toHaveBeenCalled();
    });

    it('should bind the upload task progress events to the store slice', async () => {
        const mockFile = new File(['dummy content'], 'master_track.wav', { type: 'audio/wav' });
        const { uploadBytesResumable } = await import('firebase/storage');
        
        // Setup a mock upload task with an 'on' method
        const mockOn = vi.fn();
        (uploadBytesResumable as ReturnType<typeof vi.fn>).mockReturnValueOnce({
            on: mockOn
        });

        await WhiteGloveIngestionService.enqueueAsset(mockFile, 'audio', 'artist_123');

        // We expect the 'state_changed' listener to be attached
        expect(mockOn).toHaveBeenCalledWith('state_changed', expect.any(Function), expect.any(Function), expect.any(Function));
    });

    it('should allow pausing an upload via the store slice', async () => {
        // Arrange
        const mockFile = new File(['dummy content'], 'master_track.wav', { type: 'audio/wav' });
        const { uploadBytesResumable } = await import('firebase/storage');
        const mockPause = vi.fn();
        (uploadBytesResumable as ReturnType<typeof vi.fn>).mockReturnValueOnce({
            on: vi.fn(),
            pause: mockPause
        });

        const uploadId = await WhiteGloveIngestionService.enqueueAsset(mockFile, 'audio', 'artist_123');

        // Act
        WhiteGloveIngestionService.pauseUpload(uploadId);

        // Assert
        expect(mockPause).toHaveBeenCalled();
    });

    it('should allow resuming an upload via the store slice', async () => {
        const mockFile = new File(['dummy content'], 'master_track.wav', { type: 'audio/wav' });
        const { uploadBytesResumable } = await import('firebase/storage');
        const mockResume = vi.fn();
        (uploadBytesResumable as ReturnType<typeof vi.fn>).mockReturnValueOnce({
            on: vi.fn(),
            resume: mockResume
        });

        const uploadId = await WhiteGloveIngestionService.enqueueAsset(mockFile, 'audio', 'artist_123');
        WhiteGloveIngestionService.resumeUpload(uploadId);
        expect(mockResume).toHaveBeenCalled();
    });

    it('should allow canceling an upload via the store slice', async () => {
        const mockFile = new File(['dummy content'], 'master_track.wav', { type: 'audio/wav' });
        const { uploadBytesResumable } = await import('firebase/storage');
        const mockCancel = vi.fn();
        (uploadBytesResumable as ReturnType<typeof vi.fn>).mockReturnValueOnce({
            on: vi.fn(),
            cancel: mockCancel
        });

        const uploadId = await WhiteGloveIngestionService.enqueueAsset(mockFile, 'audio', 'artist_123');
        WhiteGloveIngestionService.cancelUpload(uploadId);
        expect(mockCancel).toHaveBeenCalled();
    });
});
