import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubmitReleaseModal } from './SubmitReleaseModal';

const { mockListLibrary, mockSubmitRelease, mockUserProfile } = vi.hoisted(() => ({
    mockListLibrary: vi.fn(),
    mockSubmitRelease: vi.fn(),
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

vi.mock('@/services/music/MusicLibraryService', () => ({
    musicLibraryService: { listLibrary: mockListLibrary },
}));

vi.mock('@/services/distribution/DistributionService', () => ({
    distributionService: { submitRelease: mockSubmitRelease },
}));

const ANALYZED_TRACK = {
    id: 'track-1',
    userId: 'user-1',
    filename: 'master.wav',
    fileHash: 'abc123hash',
    features: { duration: 210, audit: { sampleRate: 44100 } },
    analyzedAt: '2026-01-01T00:00:00Z',
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
        mockListLibrary.mockResolvedValue([ANALYZED_TRACK]);
        mockSubmitRelease.mockResolvedValue({ status: 'success' });
    });

    const fillBasicMetadata = () => {
        fireEvent.change(screen.getByTestId('release-title-input'), { target: { value: 'Album' } });
        fireEvent.change(screen.getByTestId('release-artist-input'), { target: { value: 'Artist' } });
        fireEvent.change(screen.getByTestId('release-track-title-input'), { target: { value: 'Track' } });
    };

    it('keeps Submit disabled when no master track or cover asset is selected (metadata-only cannot pass)', async () => {
        render(<SubmitReleaseModal open onClose={vi.fn()} />);
        await waitFor(() => expect(mockListLibrary).toHaveBeenCalled());

        fillBasicMetadata();

        expect(screen.getByTestId('release-submit-button')).toBeDisabled();
    });

    it('enables Submit only once a real analyzed track and staged cover asset are both selected', async () => {
        render(<SubmitReleaseModal open onClose={vi.fn()} />);
        await waitFor(() => expect(mockListLibrary).toHaveBeenCalled());

        fillBasicMetadata();
        fireEvent.change(screen.getByTestId('release-track-select'), { target: { value: 'abc123hash' } });
        fireEvent.change(screen.getByTestId('release-artwork-select'), { target: { value: 'https://cdn.example.com/cover.png' } });

        expect(screen.getByTestId('release-submit-button')).toBeEnabled();
    });

    it('submits with the real file_hash/duration/sampleRate from the selected analyzed track, not freeform data', async () => {
        render(<SubmitReleaseModal open onClose={vi.fn()} />);
        await waitFor(() => expect(mockListLibrary).toHaveBeenCalled());

        fillBasicMetadata();
        fireEvent.change(screen.getByTestId('release-track-select'), { target: { value: 'abc123hash' } });
        fireEvent.change(screen.getByTestId('release-artwork-select'), { target: { value: 'https://cdn.example.com/cover.png' } });
        fireEvent.click(screen.getByTestId('release-submit-button'));

        await waitFor(() => expect(mockSubmitRelease).toHaveBeenCalled());
        const [releaseData] = mockSubmitRelease.mock.calls[0]!;
        expect(releaseData.artwork_url).toBe('https://cdn.example.com/cover.png');
        expect(releaseData.tracks[0].file_hash).toBe('abc123hash');
        expect(releaseData.tracks[0].filename).toBe('master.wav');
        expect(releaseData.tracks[0].duration).toBe(210);
        expect(releaseData.tracks[0].sample_rate).toBe(44100);
    });
});
