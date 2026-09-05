import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntityResolver } from '../resolvers/EntityResolver';
import { useStore } from '@/core/store';

describe('EntityResolver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolves a canonical note from Notes state', async () => {
        const mockNote = {
            id: 'note_123',
            title: 'Album Concept Brief',
            content: 'This EP explores futuristic synth-pop and cinematic sound design.',
            attachments: ['https://storage.googleapis.com/img1.jpg'],
            tags: ['concept', 'synthpop'],
            createdAt: 1700000000000,
            updatedAt: 1700000001000,
        };

        useStore.setState({
            notes: [mockNote],
        });

        const result = await EntityResolver.resolve({
            kind: 'note',
            entityId: 'note_123',
        });

        expect(result.status).toBe('resolved');
        expect(result.data).toBeDefined();
        const data = result.data as any;
        expect(data.title).toBe('Album Concept Brief');
        expect(data.excerpt).toContain('This EP explores');
        expect(data.attachmentCount).toBe(1);
    });

    it('returns missing status gracefully when a note cannot be found', async () => {
        useStore.setState({
            notes: [],
        });

        const result = await EntityResolver.resolve({
            kind: 'note',
            entityId: 'nonexistent_note',
        });

        expect(result.status).toBe('missing');
        expect(result.errorMessage).toContain('nonexistent_note');
    });

    it('resolves an asset from creative history', async () => {
        const mockHistoryItem = {
            id: 'asset_789',
            url: 'https://storage.googleapis.com/artwork.png',
            prompt: 'Cyberpunk album cover neon art',
            type: 'image' as const,
            timestamp: 1700000000000,
            projectId: 'proj_1',
            tags: ['cyberpunk', 'cover'],
        };

        useStore.setState({
            generatedHistory: [mockHistoryItem],
        });

        const result = await EntityResolver.resolve({
            kind: 'asset',
            entityId: 'asset_789',
        });

        expect(result.status).toBe('resolved');
        const data = result.data as any;
        expect(data.url).toBe('https://storage.googleapis.com/artwork.png');
        expect(data.mediaType).toBe('image');
        expect(data.tags).toContain('cyberpunk');
    });

    it('returns missing status for missing asset without throwing', async () => {
        useStore.setState({
            generatedHistory: [],
            uploadedImages: [],
        });

        const result = await EntityResolver.resolve({
            kind: 'asset',
            entityId: 'missing_asset',
        });

        expect(result.status).toBe('missing');
    });

    it('creates non-authoritative snapshot from resolved data', () => {
        const snapshot = EntityResolver.createSnapshotFromData('note', {
            title: 'Tour Schedule',
            excerpt: 'Dates for North American tour',
            mediaType: undefined,
            tags: ['tour', 'live'],
        });

        expect(snapshot.title).toBe('Tour Schedule');
        expect(snapshot.excerpt).toBe('Dates for North American tour');
        expect(snapshot.tags).toEqual(['tour', 'live']);
        expect(typeof snapshot.cachedAt).toBe('number');
    });
});
