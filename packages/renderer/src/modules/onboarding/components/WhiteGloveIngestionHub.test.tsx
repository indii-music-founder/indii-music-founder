import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WhiteGloveImportResult } from '@/services/ingestion/WhiteGloveIngestionService';

const { subscribeToResults, toast } = vi.hoisted(() => ({
    subscribeToResults: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/services/ingestion/WhiteGloveIngestionService', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/services/ingestion/WhiteGloveIngestionService')>()),
    WhiteGloveIngestionService: { subscribeToResults, enqueueAsset: vi.fn(), pauseUpload: vi.fn(), resumeUpload: vi.fn(), cancelUpload: vi.fn() },
}));
vi.mock('@/core/store', () => ({
    useStore: (selector: (s: { user: { uid: string }; uploadQueue: never[] }) => unknown) => selector({ user: { uid: 'artist-1' }, uploadQueue: [] }),
}));
vi.mock('@/core/context/ToastContext', () => ({ useToast: () => toast }));

import { WhiteGloveIngestionHub } from '@/modules/onboarding/components/WhiteGloveIngestionHub';

function emit(results: WhiteGloveImportResult[]) {
    subscribeToResults.mockImplementationOnce((_uid: string, onChange: (r: WhiteGloveImportResult[]) => void) => {
        onChange(results);
        return () => undefined;
    });
}

describe('WhiteGloveIngestionHub', () => {
    beforeEach(() => subscribeToResults.mockReset());

    it("shows the artist's analyzed tracks and archives from the backend", () => {
        emit([
            { id: 'a', fileName: 'night-drive.wav', assetType: 'music', status: 'processed', metadata: { bpm: 121.6, key: 'F minor', genre: 'Synthwave' } },
            { id: 'b', fileName: 'stems.zip', assetType: 'archive', status: 'processed', metadata: { files: ['kick.wav', 'bass.wav'] } },
            { id: 'c', fileName: 'demo.mp3', assetType: 'music', status: 'processing' },
            { id: 'd', fileName: 'broken.mp3', assetType: 'music', status: 'error' },
        ]);
        render(<WhiteGloveIngestionHub />);

        expect(subscribeToResults).toHaveBeenCalledWith('artist-1', expect.any(Function), expect.any(Function));
        expect(screen.getByText('122 BPM · F minor · Synthwave')).toBeInTheDocument();
        expect(screen.getByText('2 files in archive')).toBeInTheDocument();
        expect(screen.getByText('Analyzing…')).toBeInTheDocument();
        expect(screen.getByText(/could not analyze this file/)).toBeInTheDocument();
    });

    it('shows an honest empty state', () => {
        emit([]);
        render(<WhiteGloveIngestionHub />);
        expect(screen.getByText(/Nothing imported yet/)).toBeInTheDocument();
    });

    it('states the real upload limit', () => {
        emit([]);
        render(<WhiteGloveIngestionHub />);
        expect(screen.getByText(/up to 500 MB each/)).toBeInTheDocument();
        expect(screen.queryByText(/10GB/)).not.toBeInTheDocument();
    });

    it('reports a failed results subscription', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        subscribeToResults.mockImplementationOnce((_uid: string, _onChange: unknown, onError: (e: Error) => void) => {
            onError(new Error('permission-denied'));
            return () => undefined;
        });
        render(<WhiteGloveIngestionHub />);
        expect(screen.getByText(/Could not load your import results/)).toBeInTheDocument();
        expect(error).toHaveBeenCalled();
    });
});
