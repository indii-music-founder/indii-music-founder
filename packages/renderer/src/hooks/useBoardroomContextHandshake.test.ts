// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { publishBoardroomContextUpdate } from '@/hooks/useBoardroomContextHandshake';
import type { ReferencedAsset } from '@/core/store/slices/boardroomSlice';

describe('publishBoardroomContextUpdate', () => {
    const addAutomaticReferencedAssets = vi.fn<(assets: readonly ReferencedAsset[]) => void>();

    beforeEach(() => {
        addAutomaticReferencedAssets.mockReset();
    });

    it('publishes durable creative assets with prompt and lineage metadata', () => {
        publishBoardroomContextUpdate({
            generatedHistory: [
                {
                    id: 'img-1',
                    type: 'image',
                    url: 'data:image/png;base64,AAAA',
                    storageUri: 'gs://bucket/assets/img-1.png',
                    prompt: 'Album cover',
                    timestamp: 3,
                    projectId: 'p1',
                    origin: 'generated',
                    parentId: 'source-1',
                },
                {
                    id: 'vid-1',
                    type: 'video',
                    url: 'https://storage.googleapis.com/bucket/assets/vid-1.mp4',
                    storageUri: 'gs://bucket/assets/vid-1.mp4',
                    prompt: 'Performance remix',
                    timestamp: 2,
                    projectId: 'p1',
                    origin: 'generated',
                    parentId: 'source-2',
                },
                {
                    id: 'audio-1',
                    type: 'music',
                    url: 'https://storage.googleapis.com/bucket/assets/audio-1.wav',
                    storageUri: 'gs://bucket/assets/audio-1.wav',
                    prompt: 'Reference vocal take',
                    timestamp: 1,
                    projectId: 'p1',
                    origin: 'generated',
                    parentId: 'source-3',
                },
            ] as any,
            conversationMode: 'boardroom',
            distribution: { releases: [] } as any,
            addAutomaticReferencedAssets,
        } as any);

        expect(addAutomaticReferencedAssets).toHaveBeenCalledTimes(1);
        expect(addAutomaticReferencedAssets).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({
            id: 'creative-img-1',
            value: 'gs://bucket/assets/img-1.png',
            prompt: 'Album cover',
            origin: 'generated',
            parentId: 'source-1',
            storageUri: 'gs://bucket/assets/img-1.png',
            sourceType: 'image',
        })]));
        expect(addAutomaticReferencedAssets).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({
            id: 'creative-vid-1',
            value: 'gs://bucket/assets/vid-1.mp4',
            sourceType: 'video',
        })]));
        expect(addAutomaticReferencedAssets).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({
            id: 'creative-audio-1',
            value: 'gs://bucket/assets/audio-1.wav',
            sourceType: 'music',
        })]));
    });

    it('does not publish generated outputs outside Boardroom', () => {
        publishBoardroomContextUpdate({
            conversationMode: 'direct',
            generatedHistory: [{
                id: 'cover', type: 'image', url: 'https://studio.example/cover.png', prompt: 'Cover', timestamp: 3,
                projectId: 'p1',
            }],
            distribution: { releases: [] } as any,
            addAutomaticReferencedAssets,
        });
        expect(addAutomaticReferencedAssets).not.toHaveBeenCalled();
    });

    it('skips data-URI assets that are not durable enough for boardroom context', () => {
        publishBoardroomContextUpdate({
            generatedHistory: [
                {
                    id: 'img-1',
                    type: 'image',
                    url: 'data:image/png;base64,AAAA',
                    prompt: 'Ephemeral image',
                    timestamp: 3,
                    projectId: 'p1',
                    origin: 'generated',
                },
            ] as any,
            conversationMode: 'boardroom',
            distribution: { releases: [] } as any,
            addAutomaticReferencedAssets,
        } as any);

        expect(addAutomaticReferencedAssets).not.toHaveBeenCalled();
    });
});
