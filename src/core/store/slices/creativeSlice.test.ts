
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreativeSlice } from './creativeSlice';
import { HistoryItem } from '@/core/types/history';

// Mock StorageService
vi.mock('@/services/StorageService', () => ({
    StorageService: {
        loadHistory: vi.fn(),
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
        (mockStorageService.loadHistory as any).mockReset();
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

        (mockStorageService.loadHistory as any).mockResolvedValue([remoteItem1, remoteItem2]);

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

        (mockStorageService.loadHistory as any).mockResolvedValue([remoteItem]);

        await slice.initializeHistory();

        const history = slice.generatedHistory;
        const item = history.find((i: HistoryItem) => i.id === 'item1');
        expect(item.url).toBe('http://real.url/image.png');
    });
});
