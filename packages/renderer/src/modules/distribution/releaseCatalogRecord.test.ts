import { describe, expect, it } from 'vitest';
import { buildReleaseCatalogRecord, type ReleaseCatalogInput } from '@/modules/distribution/releaseCatalogRecord';

const INPUT: ReleaseCatalogInput = {
    ownerId: 'user-1',
    title: 'Album',
    artist: 'Artist',
    trackTitle: 'Track',
    label: 'Indii Records',
    genre: 'Electronic',
    masterAsset: {
        contentHash: 'a'.repeat(64),
        downloadUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/masters%2Fuser-1?alt=media&token=secret',
        masterFingerprint: 'SONIC-1',
        mimeType: 'audio/wav',
        originalFileName: 'master.wav',
        sizeBytes: 1,
        storagePath: 'masters/user-1/aaaa/original.wav',
        uploadedAt: '2026-01-01T00:00:00Z',
    },
    coverAsset: {
        content_hash: 'b'.repeat(64),
        download_url: 'https://firebasestorage.googleapis.com/v0/b/x/o/covers%2Fuser-1?alt=media&token=secret',
        mime_type: 'image/png',
        original_file_name: 'cover.png',
        size_bytes: 1,
        storage_path: `covers/user-1/${'b'.repeat(64)}/original.png`,
        generation_provenance: { source: 'uploaded' },
    },
};

function hasUndefined(value: unknown): boolean {
    if (value === undefined) return true;
    if (value && typeof value === 'object') return Object.values(value).some(hasUndefined);
    return false;
}

describe('buildReleaseCatalogRecord (ISSUE-1692)', () => {
    it('leaves out optional values instead of writing undefined, which Firestore rejects', () => {
        const record = buildReleaseCatalogRecord({ ...INPUT, orgId: '  ', releaseDate: ' ', isrc: '', durationSeconds: Number.NaN });

        expect(hasUndefined(record)).toBe(false);
        expect(record).not.toHaveProperty('orgId');
        expect(record.metadata).toEqual({
            releaseTitle: 'Album',
            trackTitle: 'Track',
            artistName: 'Artist',
            labelName: 'Indii Records',
            genre: 'Electronic',
            masterFingerprint: 'SONIC-1',
        });
        // No measured audio properties: format/rate/depth are not guessed.
        expect(record.assets).toEqual({
            audioStoragePath: 'masters/user-1/aaaa/original.wav',
            audioContentHash: 'a'.repeat(64),
            masterFingerprint: 'SONIC-1',
            coverArtStoragePath: `covers/user-1/${'b'.repeat(64)}/original.png`,
            coverArtContentHash: 'b'.repeat(64),
        });
    });

    it('records the release date, ISRC and organization when the artist gave them', () => {
        const record = buildReleaseCatalogRecord({ ...INPUT, orgId: 'org-7', releaseDate: '2026-12-05', isrc: ' USABC2600001 ' });

        expect(record).toMatchObject({
            userId: 'user-1',
            orgId: 'org-7',
            metadata: { releaseDate: '2026-12-05', isrc: 'USABC2600001' },
            assets: { isrc: 'USABC2600001' },
        });
    });

    it('never stores tokenized download URLs', () => {
        expect(JSON.stringify(buildReleaseCatalogRecord(INPUT))).not.toContain('token=');
    });
});
