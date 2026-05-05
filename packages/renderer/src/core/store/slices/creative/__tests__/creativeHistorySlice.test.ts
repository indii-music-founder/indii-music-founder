import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCreativeHistoryState, CanvasImage, CreativeHistorySlice } from '../creativeHistorySlice';

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            setViewMode: vi.fn(),
            setModule: vi.fn(),
            currentOrganizationId: 'test-org',
            currentProjectId: 'test-project',
            user: { uid: 'test-user' },
            createFileNode: vi.fn().mockResolvedValue(undefined),
            registerSubscription: vi.fn()
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
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('creativeHistorySlice — openImageInStudio', () => {
    let slice: CreativeHistorySlice;

    beforeEach(() => {
        vi.clearAllMocks();
        slice = buildCreativeHistoryState(
            (updater) => {
                const update = typeof updater === 'function' ? updater(slice) : updater;
                Object.assign(slice, update);
            },
            () => slice
        );
    });

    it('adds a canvas image on openImageInStudio call', () => {
        expect(slice.canvasImages.length).toBe(0);

        slice.openImageInStudio({
            imageId: 'test-image-id',
            sourceUrl: 'https://example.com/image.jpg',
            sourceMessageId: 'msg-123',
            agentId: 'generalist',
            prompt: 'a red car on a beach'
        });

        expect(slice.canvasImages.length).toBe(1);
    });

    it('creates canvas image with correct properties (base64=sourceUrl, x=100, y=100, w=512, h=512, projectId=chat_import)', () => {
        slice.openImageInStudio({
            imageId: 'test-image-id',
            sourceUrl: 'https://example.com/image.jpg',
            sourceMessageId: 'msg-123',
            agentId: 'generalist',
            prompt: 'a red car on a beach'
        });

        const added = slice.canvasImages[0];
        expect(added.base64).toBe('https://example.com/image.jpg');
        expect(added.x).toBe(100);
        expect(added.y).toBe(100);
        expect(added.width).toBe(512);
        expect(added.height).toBe(512);
        expect(added.projectId).toBe('chat_import');
        expect(added.prompt).toBe('a red car on a beach');
    });

    it('selects the newly imported canvas image', () => {
        expect(slice.selectedCanvasImageId).toBeNull();

        slice.openImageInStudio({
            imageId: 'test-image-id',
            sourceUrl: 'https://example.com/image.jpg',
            sourceMessageId: 'msg-123',
            agentId: 'generalist',
            prompt: 'a red car on a beach'
        });

        expect(slice.selectedCanvasImageId).toBe(slice.canvasImages[0].id);
    });

    it('populates chatImportContext with messageId, agentId, and prompt', () => {
        expect(slice.chatImportContext).toBeNull();

        slice.openImageInStudio({
            imageId: 'test-image-id',
            sourceUrl: 'https://example.com/image.jpg',
            sourceMessageId: 'msg-123',
            agentId: 'generalist',
            prompt: 'a red car on a beach'
        });

        expect(slice.chatImportContext).toEqual({
            messageId: 'msg-123',
            agentId: 'generalist',
            prompt: 'a red car on a beach'
        });
    });

    it('clears chatImportContext with clearChatImportContext action', () => {
        slice.openImageInStudio({
            imageId: 'test-image-id',
            sourceUrl: 'https://example.com/image.jpg',
            sourceMessageId: 'msg-123',
            agentId: 'generalist',
            prompt: 'a red car on a beach'
        });

        expect(slice.chatImportContext).not.toBeNull();

        slice.clearChatImportContext();

        expect(slice.chatImportContext).toBeNull();
    });

    it('generates unique layer IDs with imageId and timestamp', () => {
        slice.openImageInStudio({
            imageId: 'image-1',
            sourceUrl: 'https://example.com/image1.jpg',
            sourceMessageId: 'msg-1',
            agentId: 'generalist',
            prompt: 'prompt 1'
        });

        const id1 = slice.canvasImages[0].id;

        // Simulate delay
        slice.openImageInStudio({
            imageId: 'image-2',
            sourceUrl: 'https://example.com/image2.jpg',
            sourceMessageId: 'msg-2',
            agentId: 'generalist',
            prompt: 'prompt 2'
        });

        const id2 = slice.canvasImages[1].id;

        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^layer_image-1_\d+$/);
        expect(id2).toMatch(/^layer_image-2_\d+$/);
    });

    it('preserves existing canvas images on second import', () => {
        slice.openImageInStudio({
            imageId: 'image-1',
            sourceUrl: 'https://example.com/image1.jpg',
            sourceMessageId: 'msg-1',
            agentId: 'generalist',
            prompt: 'prompt 1'
        });

        const firstImage = { ...slice.canvasImages[0] };

        slice.openImageInStudio({
            imageId: 'image-2',
            sourceUrl: 'https://example.com/image2.jpg',
            sourceMessageId: 'msg-2',
            agentId: 'generalist',
            prompt: 'prompt 2'
        });

        expect(slice.canvasImages.length).toBe(2);
        expect(slice.canvasImages[0]).toEqual(firstImage);
        expect(slice.canvasImages[1].id).toMatch(/^layer_image-2_\d+$/);
    });
});
