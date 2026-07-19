import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDDEXRelease } from './useDDEXRelease';

const { mockAddDoc, mockUpdateDoc, mockRunAgent, mockUploadFile, mockPersistMaster, docIds } = vi.hoisted(() => ({
    mockAddDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockRunAgent: vi.fn(),
    mockUploadFile: vi.fn(),
    mockPersistMaster: vi.fn(),
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

vi.mock('@/services/audio/MasterAudioService', () => ({
    masterAudioService: { persist: mockPersistMaster },
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

const VALID_COVER_ART = {
    url: 'https://example.com/cover.png',
    mimeType: 'image/png',
    sizeBytes: 2_000_000,
    width: 3000,
    height: 3000,
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
        act(() => { result.current.updateAssets({ audioFile: VALID_AUDIO_FILE, coverArt: VALID_COVER_ART }); });

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

    it('carries canonical master identity and ISRC into the durable DDEX packaging record', async () => {
        mockRunAgent.mockResolvedValue({ text: 'Packaged successfully' });
        const { result } = renderHook(() => useDDEXRelease());
        act(() => {
            result.current.updateMetadata({ isrc: 'USABC2600001' });
            result.current.updateAssets({
                audioFile: {
                    ...VALID_AUDIO_FILE,
                    storagePath: 'masters/user-1/content-hash/original.wav',
                    contentHash: 'content-hash',
                    masterFingerprint: 'SONIC-master',
                },
                coverArt: VALID_COVER_ART,
            });
        });

        await act(async () => {
            await result.current.submitRelease();
        });

        expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            assets: expect.objectContaining({
                audioStoragePath: 'masters/user-1/content-hash/original.wav',
                audioContentHash: 'content-hash',
                masterFingerprint: 'SONIC-master',
                isrc: 'USABC2600001',
            }),
        }));
        expect(mockRunAgent).toHaveBeenCalledWith(
            'publishing',
            expect.stringContaining('Canonical audio storage path: masters/user-1/content-hash/original.wav')
        );
    });

    it('marks packaging_failed with the real error instead of silently advancing to complete', async () => {
        mockRunAgent.mockRejectedValue(new Error('Publishing agent unavailable'));
        const { result } = renderHook(() => useDDEXRelease());
        act(() => { result.current.updateAssets({ audioFile: VALID_AUDIO_FILE, coverArt: VALID_COVER_ART }); });

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
        act(() => { result.current.updateAssets({ audioFile: VALID_AUDIO_FILE, coverArt: VALID_COVER_ART }); });

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

    it('rejects an undersized cover before creating a packaging draft', async () => {
        const { result } = renderHook(() => useDDEXRelease());
        act(() => {
            result.current.updateAssets({
                audioFile: VALID_AUDIO_FILE,
                coverArt: { ...VALID_COVER_ART, width: 512, height: 512 },
            });
        });

        await act(async () => {
            await expect(result.current.submitRelease()).rejects.toThrow(/Cover art: Image too small/);
        });
        expect(mockAddDoc).not.toHaveBeenCalled();
        expect(mockRunAgent).not.toHaveBeenCalled();
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
        mockPersistMaster.mockResolvedValue({
            contentHash: 'content-hash',
            downloadUrl: 'https://storage.example.com/canonical-master.wav',
            masterFingerprint: 'SHA256-measured-hash',
            mimeType: 'audio/wav',
            originalFileName: 'master.wav',
            sizeBytes: 44,
            storagePath: 'masters/user-1/content-hash/original.wav',
            uploadedAt: '2026-07-17T00:00:00.000Z',
        });
    });

    it('persists a valid release master once at its canonical content-addressed path', async () => {
        const bytes = new Uint8Array(44);
        const view = new DataView(bytes.buffer);
        bytes.set(new TextEncoder().encode('RIFF'), 0);
        view.setUint32(4, 36, true);
        bytes.set(new TextEncoder().encode('WAVEfmt '), 8);
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 2, true);
        view.setUint32(24, 48_000, true);
        view.setUint32(28, 288_000, true);
        view.setUint16(32, 6, true);
        view.setUint16(34, 24, true);
        bytes.set(new TextEncoder().encode('data'), 36);
        const master = new File([bytes], 'master.wav', { type: 'audio/wav' });
        Object.defineProperty(master, 'arrayBuffer', {
            value: async () => bytes.buffer,
        });
        const { result } = renderHook(() => useDDEXRelease());

        let returnedUrl = '';
        await act(async () => {
            returnedUrl = await result.current.uploadAsset('audio', master);
        });

        expect(mockPersistMaster).toHaveBeenCalledWith(master, {
            userId: 'user-1',
            masterFingerprint: expect.stringMatching(/^SHA256-[a-f0-9]{64}$/),
        });
        expect(mockUploadFile).not.toHaveBeenCalled();
        expect(returnedUrl).toBe('https://storage.example.com/canonical-master.wav');
        expect(result.current.assets.audioFile).toEqual(expect.objectContaining({
            storagePath: 'masters/user-1/content-hash/original.wav',
            contentHash: 'content-hash',
            masterFingerprint: 'SHA256-measured-hash',
        }));
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
