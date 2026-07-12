import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDDEXRelease } from './useDDEXRelease';

const { mockAddDoc, mockUpdateDoc, mockRunAgent, mockUploadFile, docIds } = vi.hoisted(() => ({
    mockAddDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockRunAgent: vi.fn(),
    mockUploadFile: vi.fn(),
    docIds: { counter: 0 },
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn((_db, name) => ({ path: name })),
    addDoc: mockAddDoc,
    updateDoc: mockUpdateDoc,
    doc: vi.fn((_db, _collection, id) => ({ id })),
    serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

vi.mock('@/services/firebase', () => ({
    db: {},
    storage: {},
}));

vi.mock('@/services/StorageService', () => ({
    StorageService: { uploadFileWithProgress: mockUploadFile },
}));

vi.mock('@/services/agent/AgentService', () => ({
    agentService: { runAgent: mockRunAgent },
}));

vi.mock('@/core/store', () => ({
    useStore: (selector: any) => selector({
        currentOrganizationId: 'org-1',
        organizations: [{ id: 'org-1', name: 'Test Org' }],
        userProfile: { id: 'user-1', brandKit: { socials: {} } },
    }),
}));

// ISSUE-963: submitRelease() now requires a real WAV/FLAC master to be
// staged before it will proceed — seed one so these ISSUE-964 packaging
// tests can focus on the packaging-status behavior they're testing.
const VALID_AUDIO_FILE = {
    url: 'https://example.com/master.wav',
    mimeType: 'audio/wav',
    sizeBytes: 1_000_000,
    format: 'wav' as const,
    sampleRate: 44100,
    bitDepth: 24,
};

/**
 * ISSUE-964: submission previously marked the release metadata_complete
 * BEFORE packaging ran, then swallowed any packaging error entirely — a
 * release with no real package still ended up looking submitted/complete.
 */
describe('useDDEXRelease.submitRelease (ISSUE-964)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        docIds.counter = 0;
        mockAddDoc.mockImplementation(async () => ({ id: `release-${++docIds.counter}` }));
        mockUpdateDoc.mockResolvedValue(undefined);
    });

    it('only marks metadata_complete after packaging actually succeeds', async () => {
        mockRunAgent.mockResolvedValue({ text: 'Packaged successfully' });
        const { result } = renderHook(() => useDDEXRelease());
        act(() => { result.current.updateAssets({ audioFile: VALID_AUDIO_FILE }); });

        let returnedId = '';
        await act(async () => {
            returnedId = await result.current.submitRelease();
        });

        expect(returnedId).toBe('release-1');
        expect(mockRunAgent).toHaveBeenCalled();
        expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'metadata_complete' }));
        expect(result.current.currentStep).toBe('complete');
        expect(result.current.submitError).toBeNull();
    });

    it('marks packaging_failed with the real error instead of silently advancing to complete', async () => {
        mockRunAgent.mockRejectedValue(new Error('Publishing agent unavailable'));
        const { result } = renderHook(() => useDDEXRelease());
        act(() => { result.current.updateAssets({ audioFile: VALID_AUDIO_FILE }); });

        await act(async () => {
            await expect(result.current.submitRelease()).rejects.toThrow(/Packaging failed/);
        });

        expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            status: 'packaging_failed',
            packagingError: 'Publishing agent unavailable',
        }));
        // Never reaches the metadata_complete write.
        expect(mockUpdateDoc).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'metadata_complete' }));
        expect(result.current.currentStep).toBe('review');
        expect(result.current.submitError).toContain('Packaging failed');
        expect(result.current.releaseId).toBe('release-1');
    });

    it('retries against the same draft instead of creating a duplicate release', async () => {
        mockRunAgent
            .mockRejectedValueOnce(new Error('Transient failure'))
            .mockResolvedValueOnce({ text: 'Packaged successfully' });

        const { result } = renderHook(() => useDDEXRelease());
        act(() => { result.current.updateAssets({ audioFile: VALID_AUDIO_FILE }); });

        await act(async () => {
            await expect(result.current.submitRelease()).rejects.toThrow();
        });
        expect(mockAddDoc).toHaveBeenCalledTimes(1);
        expect(result.current.releaseId).toBe('release-1');

        let retryId = '';
        await act(async () => {
            retryId = await result.current.submitRelease();
        });

        // Still only one addDoc call across both attempts — no duplicate draft.
        expect(mockAddDoc).toHaveBeenCalledTimes(1);
        expect(retryId).toBe('release-1');
        expect(result.current.currentStep).toBe('complete');
    });
});

/**
 * ISSUE-963: decode/dimension-extraction failures previously fell back to
 * fabricated defaults (44.1kHz/24-bit audio, 3000x3000 cover) and lossy
 * MP3/AAC uploads were silently accepted (even relabeled as 'wav' at
 * submission). These prove failures now block the upload with a real
 * error instead of substituting fake measured values.
 */
describe('useDDEXRelease.uploadAsset (ISSUE-963)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUploadFile.mockResolvedValue('https://storage.example.com/uploaded-file');
    });

    it('rejects a lossy audio file before uploading any bytes', async () => {
        const { result } = renderHook(() => useDDEXRelease());
        const mp3File = new File(['fake-mp3-bytes'], 'master.mp3', { type: 'audio/mpeg' });

        await act(async () => {
            await expect(result.current.uploadAsset('audio', mp3File)).rejects.toThrow(/Only WAV or FLAC/);
        });

        expect(mockUploadFile).not.toHaveBeenCalled();
        expect(result.current.submitError).toMatch(/Only WAV or FLAC/);
    });

    it('rejects an audio file that fails to decode instead of fabricating sample rate/bit depth', async () => {
        class FailingAudioContext {
            decodeAudioData() {
                return Promise.reject(new Error('Unsupported audio format'));
            }
            close() {
                return Promise.resolve();
            }
        }
        vi.stubGlobal('AudioContext', FailingAudioContext);

        const { result } = renderHook(() => useDDEXRelease());
        const corruptWav = new File(['not-really-audio'], 'corrupt.wav', { type: 'audio/wav' });

        await act(async () => {
            await expect(result.current.uploadAsset('audio', corruptWav)).rejects.toThrow(/Could not decode/);
        });

        expect(result.current.assets.audioFile).toBeUndefined();
        vi.unstubAllGlobals();
    });

    it('rejects a cover image that fails to decode instead of fabricating 3000x3000', async () => {
        class FailingImage {
            onload: (() => void) | null = null;
            onerror: (() => void) | null = null;
            set src(_value: string) {
                queueMicrotask(() => this.onerror?.());
            }
        }
        vi.stubGlobal('Image', FailingImage);

        const { result } = renderHook(() => useDDEXRelease());
        const corruptImage = new File(['not-really-an-image'], 'cover.png', { type: 'image/png' });

        await act(async () => {
            await expect(result.current.uploadAsset('cover', corruptImage)).rejects.toThrow(/Could not read image dimensions/);
        });

        expect(result.current.assets.coverArt).toBeUndefined();
        vi.unstubAllGlobals();
    });
});
