import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getVertexAIClient } from '../../lib/vertexClient';
import * as unzipper from 'unzipper';
import * as admin from 'firebase-admin';

// Hoist mock factory
const mockDefineStorageTrigger = vi.hoisted(() => vi.fn((bucket, opts, handler) => handler));

vi.mock('../../factory', () => ({
    defineStorageTrigger: mockDefineStorageTrigger
}));

vi.mock('../../lib/vertexClient', () => ({
    getVertexAIClient: vi.fn()
}));

vi.mock('unzipper', () => ({
    Parse: vi.fn()
}));

vi.mock('firebase-admin', () => {
    const firestoreMock = {
        collection: vi.fn().mockReturnThis(),
        doc: vi.fn().mockReturnThis(),
        set: vi.fn(),
        update: vi.fn(),
        get: vi.fn()
    };
    return {
        firestore: Object.assign(vi.fn(() => firestoreMock), {
            FieldValue: {
                serverTimestamp: vi.fn().mockReturnValue('mocked-timestamp')
            }
        }),
        storage: vi.fn(() => ({
            bucket: vi.fn(() => ({
                file: vi.fn(() => ({
                    getMetadata: vi.fn().mockResolvedValue([{ contentType: 'audio/mpeg' }])
                }))
            }))
        }))
    };
});

import { onWhiteGloveAssetUploaded } from './onWhiteGloveAssetUploaded';

describe('onWhiteGloveAssetUploaded', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should ignore files not in the ingest/white-glove path', async () => {
        // Since we mocked defineStorageTrigger to return the handler directly:
        const handler = onWhiteGloveAssetUploaded as unknown as (event: any) => Promise<void>;
        
        await handler({
            data: {
                name: 'other/path/file.mp3',
                bucket: 'test-bucket',
                size: 1000
            }
        });

        const firestore = admin.firestore();
        expect(firestore.collection).not.toHaveBeenCalled();
    });

    it('should extract artistId, assetType, and filename from valid path and create document', async () => {
        const handler = onWhiteGloveAssetUploaded as unknown as (event: any) => Promise<void>;
        const mockSet = vi.fn();
        const mockDoc = vi.fn().mockReturnValue({ set: mockSet });
        const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
        // Make doc() also return a mocked collection() method that returns another mockCollection
        mockDoc.mockReturnValue({ 
            set: mockSet,
            collection: mockCollection 
        });
        
        (admin.firestore as any).mockReturnValue({
            collection: mockCollection
        });

        const mockGenerateContent = vi.fn().mockResolvedValue({
            candidates: [{
                content: {
                    parts: [{ text: JSON.stringify({ bpm: 120, key: "C Major" }) }]
                }
            }]
        });

        // Mock getVertexAIClient
        vi.mocked(getVertexAIClient).mockReturnValue({
            models: {
                generateContent: mockGenerateContent
            }
        } as any);

        await handler({
            data: {
                name: 'ingest/white-glove/artist123/music/song.mp3',
                bucket: 'test-bucket',
                size: 5000000,
                contentType: 'audio/mpeg'
            }
        });

        expect(mockCollection).toHaveBeenCalledWith('artists');
        expect(mockDoc).toHaveBeenCalledWith('artist123');
        expect(mockCollection).toHaveBeenCalledWith('assets');
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
            assetType: 'music',
            fileName: 'song.mp3',
            size: 5000000,
            status: 'processing',
            bucket: 'test-bucket',
            fullPath: 'ingest/white-glove/artist123/music/song.mp3'
        }), { merge: true });

        // Check if metadata was extracted
        expect(mockGenerateContent).toHaveBeenCalled();
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
            status: 'processed',
            metadata: { bpm: 120, key: "C Major" }
        }), { merge: true });
    });

    it('should inspect archive contents if assetType is archive', async () => {
        const handler = onWhiteGloveAssetUploaded as unknown as (event: any) => Promise<void>;
        const mockSet = vi.fn();
        const mockDoc = vi.fn().mockReturnValue({ set: mockSet, collection: vi.fn().mockReturnValue({ doc: vi.fn().mockReturnValue({ set: mockSet }) }) });
        const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
        
        (admin.firestore as any).mockReturnValue({
            collection: mockCollection
        });

        // Create a fake stream that unzipper will parse
        const mockCreateReadStream = vi.fn().mockReturnValue({
            pipe: vi.fn((dest) => dest)
        });
        (admin.storage as any).mockReturnValue({
            bucket: vi.fn().mockReturnValue({
                file: vi.fn().mockReturnValue({
                    createReadStream: mockCreateReadStream
                })
            })
        });

        const mockUnzipperParse = vi.fn().mockReturnValue({
            on: vi.fn().mockImplementation(function (this: any, event, callback) {
                if (event === 'entry') {
                    callback({ path: 'stems/drums.wav', type: 'File', autodrain: vi.fn() });
                    callback({ path: 'stems/', type: 'Directory', autodrain: vi.fn() });
                }
                if (event === 'close') {
                    callback();
                }
                return this;
            })
        });

        vi.mocked(unzipper.Parse).mockImplementation(mockUnzipperParse as any);

        await handler({
            data: {
                name: 'ingest/white-glove/artist123/archive/project.zip',
                bucket: 'test-bucket',
                size: 5000000,
                contentType: 'application/zip'
            }
        });

        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
            status: 'processed',
            metadata: {
                files: ['stems/drums.wav']
            }
        }), { merge: true });
    });
});
