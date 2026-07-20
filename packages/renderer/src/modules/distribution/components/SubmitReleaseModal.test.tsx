import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubmitReleaseModal } from './SubmitReleaseModal';

const { mockListCanonicalTracks, mockSubmitRelease, mockPersistCoverArt, mockSetDoc, mockAuditArtwork, mockUserProfile } = vi.hoisted(() => ({
    mockListCanonicalTracks: vi.fn(),
    mockSubmitRelease: vi.fn(),
    mockPersistCoverArt: vi.fn(),
    mockSetDoc: vi.fn(),
    mockAuditArtwork: vi.fn(),
    mockUserProfile: {
        id: 'user-1',
        displayName: 'Test Artist',
        brandKit: {
            releaseDetails: {},
            brandAssets: [{ url: 'https://cdn.example.com/cover.png', description: 'Main Cover' }],
            referenceImages: [],
        },
    },
}));

vi.mock('@/core/context/ToastContext', () => ({
    useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: any) => selector({ userProfile: mockUserProfile }),
}));

vi.mock('@/services/metadata/TrackLibraryService', () => ({
    trackLibrary: { list: mockListCanonicalTracks },
}));

vi.mock('@/services/distribution/DistributionService', () => ({
    distributionService: { submitRelease: mockSubmitRelease },
}));

vi.mock('@/services/distribution/CanonicalCoverArtService', () => ({
    canonicalCoverArtService: { persistFromUrl: mockPersistCoverArt },
}));

vi.mock('@/services/firebase', () => ({ db: {}, functions: {} }));
vi.mock('firebase/firestore', () => ({
    doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}` })),
    serverTimestamp: vi.fn(() => 'server-timestamp'),
    setDoc: mockSetDoc,
}));
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => mockAuditArtwork) }));

const CANONICAL_TRACK = {
    id: 'SONIC-master-1',
    userId: 'user-1',
    trackTitle: 'Canonical Master',
    artistName: 'Test Artist',
    durationSeconds: 210,
    audioTechnical: { sampleRate: 48000, channels: 2 },
    masterFingerprint: 'SONIC-master-1',
    masterAsset: {
        audioProperties: {
            bitDepth: 24,
            channels: 2,
            codec: 'PCM',
            container: 'wav',
            sampleRate: 48000,
        },
        contentHash: 'a'.repeat(64),
        downloadUrl: 'https://firebasestorage.googleapis.com/v0/b/indii-test/o/masters%2Fuser-1%2Fmaster.wav?alt=media&token=test',
        masterFingerprint: 'SONIC-master-1',
        mimeType: 'audio/wav',
        originalFileName: 'master.wav',
        sizeBytes: 4096,
        storagePath: 'masters/user-1/master.wav',
        uploadedAt: '2026-01-01T00:00:00Z',
    },
};

/**
 * ISSUE-969: submission previously required only free-text metadata (no
 * audio-file/asset selector at all, artwork was an unverified URL string).
 * These prove the modal now requires selecting a real, already-hashed
 * analyzed track and a real staged brand asset before it can submit.
 */
describe('SubmitReleaseModal (ISSUE-969)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockListCanonicalTracks.mockResolvedValue([CANONICAL_TRACK]);
        mockSubmitRelease.mockResolvedValue({ status: 'success' });
        mockSetDoc.mockResolvedValue(undefined);
        mockAuditArtwork.mockResolvedValue({ data: { status: 'compliant' } });
        mockPersistCoverArt.mockResolvedValue({
            content_hash: 'b'.repeat(64),
            download_url: 'https://firebasestorage.googleapis.com/v0/b/indii-test/o/covers%2Fuser-1%2Fcover?alt=media',
            mime_type: 'image/png',
            original_file_name: 'cover.png',
            size_bytes: 4096,
            storage_path: `covers/user-1/${'b'.repeat(64)}/original.png`,
        });
    });

    const fillBasicMetadata = () => {
        fireEvent.change(screen.getByTestId('release-title-input'), { target: { value: 'Album' } });
        fireEvent.change(screen.getByTestId('release-artist-input'), { target: { value: 'Artist' } });
        fireEvent.change(screen.getByTestId('release-track-title-input'), { target: { value: 'Track' } });
    };

    it('keeps Submit disabled when no master track or cover asset is selected (metadata-only cannot pass)', async () => {
        render(<SubmitReleaseModal open onClose={vi.fn()} />);
        await waitFor(() => expect(mockListCanonicalTracks).toHaveBeenCalled());

        fillBasicMetadata();

        expect(screen.getByTestId('release-submit-button')).toBeDisabled();
    });

    it('enables Submit only once a canonical master and staged cover asset are both selected', async () => {
        render(<SubmitReleaseModal open onClose={vi.fn()} />);
        await waitFor(() => expect(mockListCanonicalTracks).toHaveBeenCalled());

        fillBasicMetadata();
        fireEvent.change(screen.getByTestId('release-track-select'), { target: { value: 'SONIC-master-1' } });
        fireEvent.change(screen.getByTestId('release-artwork-select'), { target: { value: 'https://cdn.example.com/cover.png' } });

        expect(screen.getByTestId('release-submit-button')).toBeEnabled();
    });

    it('submits duration and filename from the selected canonical master', async () => {
        render(<SubmitReleaseModal open onClose={vi.fn()} />);
        await waitFor(() => expect(mockListCanonicalTracks).toHaveBeenCalled());

        fillBasicMetadata();
        fireEvent.change(screen.getByTestId('release-track-select'), { target: { value: 'SONIC-master-1' } });
        fireEvent.change(screen.getByTestId('release-artwork-select'), { target: { value: 'https://cdn.example.com/cover.png' } });
        fireEvent.click(screen.getByTestId('release-submit-button'));

        await waitFor(() => expect(mockSubmitRelease).toHaveBeenCalled());
        const [releaseData] = mockSubmitRelease.mock.calls[0]!;
        expect(mockPersistCoverArt).toHaveBeenCalledWith('https://cdn.example.com/cover.png', {
            userId: 'user-1',
            originalFileName: 'Main Cover',
        });
        expect(releaseData.artwork_url).toContain('firebasestorage.googleapis.com');
        expect(releaseData.cover_asset).toMatchObject({
            storage_path: `covers/user-1/${'b'.repeat(64)}/original.png`,
            content_hash: 'b'.repeat(64),
        });
        expect(releaseData.tracks[0].filename).toBe('master.wav');
        expect(releaseData.tracks[0].duration).toBe(210);
        expect(releaseData.tracks[0].sample_rate).toBe(48000);
        expect(releaseData.tracks[0].channels).toBe(2);
        expect(releaseData.tracks[0].codec).toBe('PCM');
        expect(releaseData.tracks[0].bit_depth).toBe(24);
        expect(mockSetDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                userId: 'user-1',
                coverArtStoragePath: `covers/user-1/${'b'.repeat(64)}/original.png`,
            }),
        );
        expect(mockAuditArtwork).toHaveBeenCalledWith({ releaseId: releaseData.releaseId });
    });

    it('submits the immutable canonical master reference instead of analysis-cache metadata alone', async () => {
        render(<SubmitReleaseModal open onClose={vi.fn()} />);
        await waitFor(() => expect(mockListCanonicalTracks).toHaveBeenCalled());

        fillBasicMetadata();
        fireEvent.change(screen.getByTestId('release-track-select'), { target: { value: 'SONIC-master-1' } });
        fireEvent.change(screen.getByTestId('release-artwork-select'), { target: { value: 'https://cdn.example.com/cover.png' } });
        fireEvent.click(screen.getByTestId('release-submit-button'));

        await waitFor(() => expect(mockSubmitRelease).toHaveBeenCalled());
        const [releaseData] = mockSubmitRelease.mock.calls[0]!;
        expect(releaseData.tracks[0].master_asset).toEqual({
            content_hash: CANONICAL_TRACK.masterAsset.contentHash,
            download_url: CANONICAL_TRACK.masterAsset.downloadUrl,
            master_fingerprint: CANONICAL_TRACK.masterAsset.masterFingerprint,
            mime_type: CANONICAL_TRACK.masterAsset.mimeType,
            original_file_name: CANONICAL_TRACK.masterAsset.originalFileName,
            size_bytes: CANONICAL_TRACK.masterAsset.sizeBytes,
            storage_path: CANONICAL_TRACK.masterAsset.storagePath,
        });
    });
});
