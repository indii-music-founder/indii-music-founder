
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreativeSlice } from './creativeSlice';
import { HistoryItem } from '@/core/types/history';

// Mock StorageService
vi.mock('@/services/StorageService', () => ({
    StorageService: {
        subscribeToHistory: vi.fn(),
        saveItem: vi.fn().mockResolvedValue(true),
        removeItem: vi.fn().mockResolvedValue(true)
    }
}));

describe('CreativeSlice - initializeHistory', () => {
    let mockSet: any;
    let mockGet: any;
    let slice: any;
    let mockStorageService: any;

    beforeEach(async () => {
        mockSet = vi.fn((updateFn) => {
            if (typeof updateFn === 'function') {
                const newState = updateFn(slice);
                Object.assign(slice, newState);
            } else {
                Object.assign(slice, updateFn);
            }
        });
        mockGet = vi.fn(() => slice);

        slice = createCreativeSlice(mockSet, mockGet, {} as any);

        // Reset storage mock
        const { StorageService } = await import('@/services/StorageService');
        mockStorageService = StorageService;
        (mockStorageService.subscribeToHistory as any).mockReset();
    });

    it('should correctly merge remote history with local history preserving data URIs', async () => {
        // Setup initial local state
        const localItem: HistoryItem = {
            id: 'item1',
            url: 'data:image/png;base64,LOCAL_DATA',
            type: 'image',
            prompt: 'test prompt',
            timestamp: 100,
            projectId: 'p1',
            origin: 'generated'
        };

        // Set initial state
        slice.generatedHistory = [localItem];

        // Setup remote history
        const remoteItem1: HistoryItem = {
            id: 'item1',
            url: 'placeholder:dev-data-uri-too-large',
            type: 'image',
            prompt: 'test prompt remote update', // Updated field
            timestamp: 100,
            projectId: 'p1',
            origin: 'generated'
        };

        const remoteItem2: HistoryItem = {
            id: 'item2',
            url: 'http://remote.url/img.png',
            type: 'image',
            prompt: 'new item',
            timestamp: 200,
            projectId: 'p1',
            origin: 'generated'
        };

        (mockStorageService.subscribeToHistory as any).mockImplementation((limit: number, cb: any) => {
            cb([remoteItem1, remoteItem2]);
            return Promise.resolve(vi.fn());
        });

        // Run initialization
        await slice.initializeHistory();

        // Verify set was called
        expect(mockSet).toHaveBeenCalled();

        const history = slice.generatedHistory;
        expect(history).toHaveLength(2);

        // Verify item1 preservation logic
        const mergedItem1 = history.find((i: HistoryItem) => i.id === 'item1');
        expect(mergedItem1).toBeDefined();
        // Should keep local data URI
        expect(mergedItem1.url).toBe('data:image/png;base64,LOCAL_DATA');
        // Should take other fields from remote
        expect(mergedItem1.prompt).toBe('test prompt remote update');

        // Verify item2 added
        const mergedItem2 = history.find((i: HistoryItem) => i.id === 'item2');
        expect(mergedItem2).toBeDefined();
        expect(mergedItem2.url).toBe('http://remote.url/img.png');
    });

    it('should overwrite local item if remote is not placeholder', async () => {
        const localItem: HistoryItem = {
            id: 'item1',
            url: 'data:image/png;base64,LOCAL_DATA',
            type: 'image',
            prompt: 'test',
            timestamp: 100,
            projectId: 'p1',
            origin: 'generated'
        };

        slice.generatedHistory = [localItem];

        const remoteItem: HistoryItem = {
            id: 'item1',
            url: 'http://real.url/image.png', // Real URL, should overwrite local data URI
            type: 'image',
            prompt: 'test',
            timestamp: 100,
            projectId: 'p1',
            origin: 'generated'
        };

        (mockStorageService.subscribeToHistory as any).mockImplementation((limit: number, cb: any) => {
            cb([remoteItem]);
            return Promise.resolve(vi.fn());
        });

        await slice.initializeHistory();

        const history = slice.generatedHistory;
        const item = history.find((i: HistoryItem) => i.id === 'item1');
        expect(item.url).toBe('http://real.url/image.png');
    });

    it('should correctly separate items into generated, uploadedImages, and uploadedAudio', async () => {
        const generatedItem: HistoryItem = {
            id: 'gen1',
            type: 'image',
            url: 'url',
            prompt: 'prompt',
            timestamp: 300,
            projectId: 'p1',
            origin: 'generated'
        };

        const uploadedImageItem: HistoryItem = {
            id: 'upImg1',
            type: 'image',
            url: 'url',
            prompt: 'prompt',
            timestamp: 200,
            projectId: 'p1',
            origin: 'uploaded'
        };

        const uploadedAudioItem: HistoryItem = {
            id: 'upAud1',
            type: 'music',
            url: 'url',
            prompt: 'prompt',
            timestamp: 100,
            projectId: 'p1',
            origin: 'uploaded'
        };

        const otherUploadedItem: HistoryItem = {
            id: 'upVideo1',
            type: 'video',
            url: 'url',
            prompt: 'prompt',
            timestamp: 50,
            projectId: 'p1',
            origin: 'uploaded'
        };

        (mockStorageService.subscribeToHistory as any).mockImplementation((limit: number, cb: any) => {
            cb([
                generatedItem,
                uploadedImageItem,
                uploadedAudioItem,
                otherUploadedItem
            ]);
            return Promise.resolve(vi.fn());
        });

        await slice.initializeHistory();

        expect(slice.generatedHistory).toContainEqual(generatedItem);
        expect(slice.generatedHistory).not.toContainEqual(uploadedImageItem);

        expect(slice.uploadedImages).toContainEqual(uploadedImageItem);
        expect(slice.uploadedImages).not.toContainEqual(generatedItem);

        expect(slice.uploadedAudio).toContainEqual(uploadedAudioItem);

        // Ensure other uploaded items (like video) don't end up in specific lists if logic dictates
        expect(slice.generatedHistory).not.toContainEqual(otherUploadedItem);
        expect(slice.uploadedImages).not.toContainEqual(otherUploadedItem);
        expect(slice.uploadedAudio).not.toContainEqual(otherUploadedItem);
    });
});
