import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create } from 'zustand';
import { buildCreativeHistoryState, type CreativeHistorySlice } from '../creativeHistorySlice';
import type { CanvasImage } from '../creativeHistorySlice';

/**
 * Unit test for creativeHistorySlice — specifically the openImageInStudio action
 * and chatImportContext lifecycle.
 */

// Mock the dynamic imports within buildCreativeHistoryState
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            currentOrganizationId: 'test-org',
            currentProjectId: 'test-proj',
            createFileNode: vi.fn(),
            user: { uid: 'test-user' },
            setViewMode: vi.fn(),
            setModule: vi.fn()
        })
    }
}));

vi.mock('@/services/StorageService', () => ({
    StorageService: {
        saveItem: vi.fn().mockResolvedValue(undefined),
        subscribeToHistory: vi.fn().mockResolvedValue(() => {}),
        removeItem: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('@/utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn()
    }
}));

describe('CreativeHistorySlice — openImageInStudio', () => {
    let store: ReturnType<typeof create<CreativeHistorySlice>>;

    beforeEach(() => {
        // Create a fresh store for each test using Zustand's create + buildCreativeHistoryState
        store = create<CreativeHistorySlice>((set, get) =>
            buildCreativeHistoryState(set, get)
        );
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should add a canvas image when openImageInStudio is called', () => {
        const state = store.getState();

        state.openImageInStudio({
            imageId: 'img-123',
            sourceUrl: 'https://example.com/image.jpg',
            sourceMessageId: 'msg-456',
            agentId: 'generalist',
            prompt: 'neon dog'
        });

        const updatedState = store.getState();
        expect(updatedState.canvasImages).toHaveLength(1);
    });

    it('should set canvasImage properties correctly', () => {
        const state = store.getState();

        state.openImageInStudio({
            imageId: 'img-123',
            sourceUrl: 'https://example.com/image.jpg',
            sourceMessageId: 'msg-456',
            agentId: 'generalist',
            prompt: 'neon dog'
        });

        const updatedState = store.getState();
        const canvasImage = updatedState.canvasImages[0];

        expect(canvasImage).toBeDefined();
        expect(canvasImage.base64).toBe('https://example.com/image.jpg');
        expect(canvasImage.x).toBe(100);
        expect(canvasImage.y).toBe(100);
        expect(canvasImage.width).toBe(512);
        expect(canvasImage.height).toBe(512);
        expect(canvasImage.aspect).toBe(1);
        expect(canvasImage.projectId).toBe('chat_import');
        expect(canvasImage.prompt).toBe('neon dog');
    });

    it('should select the newly added canvas image', () => {
        const state = store.getState();

        state.openImageInStudio({
            imageId: 'img-123',
            sourceUrl: 'https://example.com/image.jpg',
            sourceMessageId: 'msg-456',
            agentId: 'generalist',
            prompt: 'neon dog'
        });

        const updatedState = store.getState();
        expect(updatedState.selectedCanvasImageId).toBe(updatedState.canvasImages[0].id);
    });

    it('should set chatImportContext with message origin', () => {
        const state = store.getState();

        state.openImageInStudio({
            imageId: 'img-123',
            sourceUrl: 'https://example.com/image.jpg',
            sourceMessageId: 'msg-456',
            agentId: 'generalist',
            prompt: 'neon dog'
        });

        const updatedState = store.getState();
        expect(updatedState.chatImportContext).toEqual({
            messageId: 'msg-456',
            agentId: 'generalist',
            prompt: 'neon dog'
        });
    });

    it('should clear chatImportContext when clearChatImportContext is called', () => {
        const state = store.getState();

        // First, set up a chat import context
        state.openImageInStudio({
            imageId: 'img-123',
            sourceUrl: 'https://example.com/image.jpg',
            sourceMessageId: 'msg-456',
            agentId: 'generalist',
            prompt: 'neon dog'
        });

        let updatedState = store.getState();
        expect(updatedState.chatImportContext).not.toBeNull();

        // Now clear it
        updatedState.clearChatImportContext();

        updatedState = store.getState();
        expect(updatedState.chatImportContext).toBeNull();
    });

    it('should generate unique layer IDs for multiple imports', () => {
        const state = store.getState();

        state.openImageInStudio({
            imageId: 'img-1',
            sourceUrl: 'https://example.com/img1.jpg',
            sourceMessageId: 'msg-1',
            agentId: 'generalist',
            prompt: 'dog'
        });

        // Small delay to ensure different timestamps
        const timestamp1 = store.getState().canvasImages[0].id;

        state.openImageInStudio({
            imageId: 'img-2',
            sourceUrl: 'https://example.com/img2.jpg',
            sourceMessageId: 'msg-2',
            agentId: 'brand',
            prompt: 'cat'
        });

        const images = store.getState().canvasImages;
        expect(images).toHaveLength(2);
        expect(images[0].id).not.toBe(images[1].id);
        expect(images[0].id).toContain('layer_img-1');
        expect(images[1].id).toContain('layer_img-2');
    });

    it('should preserve existing canvas images when adding a new one', () => {
        const state = store.getState();

        // Add first image
        state.openImageInStudio({
            imageId: 'img-1',
            sourceUrl: 'https://example.com/img1.jpg',
            sourceMessageId: 'msg-1',
            agentId: 'generalist',
            prompt: 'dog'
        });

        const firstImageId = store.getState().canvasImages[0].id;

        // Add second image
        state.openImageInStudio({
            imageId: 'img-2',
            sourceUrl: 'https://example.com/img2.jpg',
            sourceMessageId: 'msg-2',
            agentId: 'brand',
            prompt: 'cat'
        });

        const images = store.getState().canvasImages;
        expect(images).toHaveLength(2);
        expect(images[0].id).toBe(firstImageId);
    });
});
