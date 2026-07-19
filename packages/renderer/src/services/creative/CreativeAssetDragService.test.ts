import { describe, expect, it } from 'vitest';
import {
    CREATIVE_ASSET_MIME,
    createResourceAssetPayload,
    creativeAssetPayloadToHistoryItem,
    readCreativeAssetDrag,
    writeCreativeAssetDrag,
} from './CreativeAssetDragService';

function createDataTransfer(): DataTransfer {
    const values = new Map<string, string>();
    return {
        effectAllowed: 'uninitialized',
        dropEffect: 'none',
        files: [] as unknown as FileList,
        items: [] as unknown as DataTransferItemList,
        types: [],
        clearData: (format?: string) => {
            if (format) values.delete(format);
            else values.clear();
        },
        getData: (format: string) => values.get(format) || '',
        setData: (format: string, data: string) => { values.set(format, data); },
        setDragImage: () => undefined,
    } as DataTransfer;
}

describe('CreativeAssetDragService', () => {
    it('writes one canonical payload with backwards-compatible editor and id formats', () => {
        const dataTransfer = createDataTransfer();
        writeCreativeAssetDrag(dataTransfer, {
            id: 'image-1',
            type: 'image',
            url: 'https://example.test/image.png',
            storageUri: 'gs://bucket/image.png',
            prompt: 'Cover image',
            timestamp: 1,
            projectId: 'project-1',
        }, 'gallery');

        expect(dataTransfer.getData(CREATIVE_ASSET_MIME)).toContain('"kind":"creative-asset"');
        expect(dataTransfer.getData('application/json')).toContain('"type":"asset"');
        expect(dataTransfer.getData('text/plain')).toBe('image-1');
        expect(dataTransfer.getData('image/url')).toBe('https://example.test/image.png');

        const parsed = readCreativeAssetDrag(dataTransfer);
        expect(parsed?.source).toBe('gallery');
        expect(parsed?.asset.storageUri).toBe('gs://bucket/image.png');
        expect(creativeAssetPayloadToHistoryItem(parsed!)?.type).toBe('image');
    });

    it('reads the legacy timeline payload during migration', () => {
        const dataTransfer = createDataTransfer();
        dataTransfer.setData('application/json', JSON.stringify({
            type: 'asset',
            asset: { type: 'audio', url: 'https://example.test/song.wav', name: 'Song' },
        }));

        const parsed = readCreativeAssetDrag(dataTransfer);
        expect(parsed?.asset.type).toBe('music');
        expect(parsed?.asset.name).toBe('Song');
    });

    it('exposes project documents without pretending creative stages can render them', () => {
        const payload = createResourceAssetPayload({
            id: 'doc-1',
            name: 'Release agreement.pdf',
            type: 'file',
            parentId: null,
            projectId: 'project-1',
            userId: 'user-1',
            fileType: 'document',
            data: { url: 'https://example.test/agreement.pdf', mimeType: 'application/pdf' },
            createdAt: 1,
            updatedAt: 1,
        });

        expect(payload?.asset.type).toBe('document');
        expect(creativeAssetPayloadToHistoryItem(payload!)).toBeNull();
    });

    it('rejects malformed canonical payloads', () => {
        const dataTransfer = createDataTransfer();
        dataTransfer.setData(CREATIVE_ASSET_MIME, '{"version":1,"kind":"creative-asset","asset":{"type":"video"}}');
        expect(readCreativeAssetDrag(dataTransfer)).toBeNull();
    });

    it('rejects executable URLs and strips unknown fields', () => {
        const dataTransfer = createDataTransfer();
        dataTransfer.setData(CREATIVE_ASSET_MIME, JSON.stringify({
            version: 1,
            kind: 'creative-asset',
            source: 'forged-source',
            apiKey: 'must-not-survive',
            asset: {
                id: 'bad-1',
                type: 'image',
                url: 'javascript:alert(1)',
                name: 'Bad asset',
                prompt: 'Bad asset',
            },
        }));
        expect(readCreativeAssetDrag(dataTransfer)).toBeNull();

        dataTransfer.setData(CREATIVE_ASSET_MIME, JSON.stringify({
            version: 1,
            kind: 'creative-asset',
            source: 'forged-source',
            apiKey: 'must-not-survive',
            asset: {
                id: 'safe-1',
                type: 'image',
                url: 'https://example.test/safe.png',
                name: 'Safe asset',
                prompt: 'Safe asset',
                unexpected: 'discard me',
            },
        }));
        const parsed = readCreativeAssetDrag(dataTransfer) as unknown as Record<string, unknown>;
        expect(parsed.source).toBe('unknown');
        expect(parsed).not.toHaveProperty('apiKey');
        expect(parsed.asset).not.toHaveProperty('unexpected');
    });
});
