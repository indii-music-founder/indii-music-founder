/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreativeSlice } from './creativeSlice';
import { create } from 'zustand';

// Mock dependencies
vi.mock('@/services/StorageService', () => ({
    StorageService: {
        loadHistory: vi.fn(),
        saveItem: vi.fn(),
        removeItem: vi.fn()
    }
}));

// Mock store to avoid circular dependency issues in the slice
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({ currentOrganizationId: 'org1' })
    }
}));

describe('creativeSlice', () => {
    let store: any;
    let StorageServiceMock: any;

    beforeEach(async () => {
        // Reset mocks
        vi.clearAllMocks();
        const mod = await import('@/services/StorageService');
        StorageServiceMock = mod.StorageService;

        // Create a fresh store for each test
        const useStore = create((set, get, api) => ({
            ...createCreativeSlice(set as any, get as any, api as any)
        }));
        store = useStore;
    });

    it('initializeHistory merges local and remote history correctly', async () => {
        // Setup local state
        const localItem1 = { id: '1', timestamp: 100, url: 'local_url_1', type: 'image', origin: 'generated' };
        const localItem2 = { id: '2', timestamp: 200, url: 'data:image/png;base64,local_blob', type: 'image', origin: 'generated' };

        store.setState({ generatedHistory: [localItem2, localItem1] });

        // Setup remote history (mock)
        const remoteItem2 = { id: '2', timestamp: 200, url: 'placeholder:dev-data-uri-too-large', type: 'image', origin: 'generated' }; // Should NOT overwrite local data URI
        const remoteItem3 = { id: '3', timestamp: 300, url: 'remote_url_3', type: 'image', origin: 'generated' }; // New item

        StorageServiceMock.loadHistory.mockResolvedValue([remoteItem3, remoteItem2]);

        // Run action
        await store.getState().initializeHistory();

        // Verify
        const history = store.getState().generatedHistory;

        // Check contents
        expect(history).toHaveLength(3);

        // Check Item 2: Should keep local URL because remote is placeholder
        const item2 = history.find((i: any) => i.id === '2');
        expect(item2).toBeDefined();
        expect(item2.url).toBe(localItem2.url);

        // Check Item 3: Should be added
        const item3 = history.find((i: any) => i.id === '3');
        expect(item3).toBeDefined();
        expect(item3.url).toBe(remoteItem3.url);

        // Check Item 1: Should still exist
        const item1 = history.find((i: any) => i.id === '1');
        expect(item1).toBeDefined();
    });
});
