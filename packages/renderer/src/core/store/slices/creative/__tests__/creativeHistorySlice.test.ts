
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { buildCreativeHistoryState, CanvasImage, CreativeHistorySlice } from '../creativeHistorySlice';
import type { StoreState } from '@/core/store';

const { createFileNodeMock, storeStateMock } = vi.hoisted(() => {
    const createFileNodeMock = vi.fn().mockResolvedValue(undefined);
    const storeStateMock = {
        setViewMode: vi.fn(),
        setModule: vi.fn(),
        currentOrganizationId: 'test-org',
        currentProjectId: 'test-project',
        user: { uid: 'test-user' },
        createFileNode: createFileNodeMock,
        registerSubscription: vi.fn()
    };

    return { createFileNodeMock, storeStateMock };
});

vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => storeStateMock
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



describe('creativeHistorySlice — openImageInStudio', () => {
    let slice: CreativeHistorySlice;

    beforeEach(() => {
        vi.clearAllMocks();
        slice = buildCreativeHistoryState(
            (updater) => {
                const update = typeof updater === 'function' ? updater(slice as unknown as StoreState) : updater;
                Object.assign(slice, update);
            },
            () => slice as unknown as StoreState
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
        expect(added?.base64).toBe('https://example.com/image.jpg');
        expect(added?.x).toBe(100);
        expect(added?.y).toBe(100);
        expect(added?.width).toBe(512);
        expect(added?.height).toBe(512);
        expect(added?.projectId).toBe('chat_import');
        expect(added?.prompt).toBe('a red car on a beach');
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

        expect(slice.selectedCanvasImageId).toBe(slice.canvasImages[0]?.id);
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

    it('cascades repeated imports instead of stacking invisibly (ISSUE-1362)', () => {
        slice.openImageInStudio({
            imageId: 'img-1',
            sourceUrl: 'https://example.com/1.jpg',
            sourceMessageId: 'm1',
            agentId: 'generalist',
            prompt: 'first'
        });
        slice.openImageInStudio({
            imageId: 'img-2',
            sourceUrl: 'https://example.com/2.jpg',
            sourceMessageId: 'm2',
            agentId: 'generalist',
            prompt: 'second'
        });
        slice.openImageInStudio({
            imageId: 'img-3',
            sourceUrl: 'https://example.com/3.jpg',
            sourceMessageId: 'm3',
            agentId: 'generalist',
            prompt: 'third'
        });

        const [first, second, third] = slice.canvasImages;
        // Only the selected image is imported per call — three calls, three
        // layers, each visibly offset from the previous (never stacked).
        expect(slice.canvasImages).toHaveLength(3);
        expect(first?.x).toBe(100);
        expect(first?.y).toBe(100);
        expect(second?.x).toBe(132);
        expect(second?.y).toBe(132);
        expect(third?.x).toBe(164);
        expect(third?.y).toBe(164);
        // The latest import is selected.
        expect(slice.selectedCanvasImageId).toBe(third?.id);
    });

    it('generates unique layer IDs with imageId and timestamp', () => {
        slice.openImageInStudio({
            imageId: 'image-1',
            sourceUrl: 'https://example.com/image1.jpg',
            sourceMessageId: 'msg-1',
            agentId: 'generalist',
            prompt: 'prompt 1'
        });

        const id1 = slice.canvasImages[0]?.id;

        // Simulate delay
        slice.openImageInStudio({
            imageId: 'image-2',
            sourceUrl: 'https://example.com/image2.jpg',
            sourceMessageId: 'msg-2',
            agentId: 'generalist',
            prompt: 'prompt 2'
        });

        const id2 = slice.canvasImages[1]?.id;

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
        expect(slice.canvasImages[1]?.id).toMatch(/^layer_image-2_\d+$/);
    });

    it('clears selection and failed variation state when their source layer is removed', () => {
        const source: CanvasImage = {
            id: 'source-layer',
            base64: 'data:image/png;base64,source',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            aspect: 1,
            projectId: 'test-project',
        };
        slice.addCanvasImage(source);
        slice.selectCanvasImage(source.id);
        slice.setFailedVariationBatch({
            source,
            prompt: 'variation prompt',
            mimeType: 'image/png',
            base64Data: 'source',
            projectId: 'test-project',
            slots: [0],
        });

        slice.removeCanvasImage(source.id);

        expect(slice.canvasImages).toHaveLength(0);
        expect(slice.selectedCanvasImageId).toBeNull();
        expect(slice.failedVariationBatch).toBeNull();
    });

    it('preserves selection when a different layer is removed', () => {
        const selected: CanvasImage = {
            id: 'selected-layer',
            base64: 'data:image/png;base64,selected',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            aspect: 1,
            projectId: 'test-project',
        };
        const other = { ...selected, id: 'other-layer' };
        slice.addCanvasImage(selected);
        slice.addCanvasImage(other);
        slice.selectCanvasImage(selected.id);

        slice.removeCanvasImage(other.id);

        expect(slice.selectedCanvasImageId).toBe(selected.id);
        expect(slice.canvasImages.map(image => image.id)).toEqual([selected.id]);
    });

    it('syncs file nodes with storage URIs when generated history items already have them', async () => {
        slice.addToHistory({
            id: 'history-1',
            url: 'data:image/png;base64,preview-only',
            storageUri: 'gs://bucket/users/test-user/assets/history-1',
            prompt: 'generated asset',
            type: 'image',
            timestamp: Date.now(),
            projectId: 'test-project',
            origin: 'editor',
        });

        await waitFor(() => {
            expect(createFileNodeMock).toHaveBeenCalledWith(
                'editor-history-.png',
                null,
                'test-project',
                'test-user',
                'image',
                expect.objectContaining({
                    url: 'gs://bucket/users/test-user/assets/history-1',
                    storagePath: 'gs://bucket/users/test-user/assets/history-1',
                    mimeType: 'image/png',
                })
            );
        }, { timeout: 3000 });
    });

    /**
     * ISSUE-810: file-node sync previously hardcoded every generated asset's
     * filename as `.png` — even videos. These prove a video asset now gets a
     * real video extension instead of a fabricated image one.
     */
    it('syncs a video history item with a .mp4 filename, not .png (ISSUE-810)', async () => {
        slice.addToHistory({
            id: 'history-video-1',
            url: 'data:video/mp4;base64,preview-only',
            storageUri: 'gs://bucket/users/test-user/assets/history-video-1',
            prompt: 'generated video',
            type: 'video',
            timestamp: Date.now(),
            projectId: 'test-project',
            origin: 'generated',
        });

        await waitFor(() => {
            expect(createFileNodeMock).toHaveBeenCalledWith(
                'generated-history-.mp4',
                null,
                'test-project',
                'test-user',
                'video',
                expect.objectContaining({
                    mimeType: 'video/mp4',
                })
            );
        }, { timeout: 3000 });
    });

    it('preserves the real extension when the storage URI already carries one (ISSUE-810)', async () => {
        slice.addToHistory({
            id: 'history-webm-1',
            url: 'https://storage.example.com/renders/history-webm-1.webm',
            storageUri: 'gs://bucket/users/test-user/assets/history-webm-1.webm',
            prompt: 'generated video',
            type: 'video',
            timestamp: Date.now(),
            projectId: 'test-project',
            origin: 'generated',
        });

        await waitFor(() => {
            expect(createFileNodeMock).toHaveBeenCalledWith(
                'generated-history-.webm',
                null,
                'test-project',
                'test-user',
                'video',
                expect.objectContaining({
                    mimeType: 'video/webm',
                })
            );
        }, { timeout: 3000 });
    });
});
