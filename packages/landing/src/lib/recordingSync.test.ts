import { describe, it, expect, vi } from 'vitest';
import { syncRecordingToCloud, DEFAULT_RECORDING_MAX_RETRIES } from './recordingSync';

const blob = new Blob(['fake-audio'], { type: 'audio/webm' });
const noopSleep = async () => {};

describe('syncRecordingToCloud', () => {
    it('reuses the same document id across retries so a lost write response never duplicates the record', async () => {
        const docIds = new Set<string>();
        let registerCalls = 0;

        const result = await syncRecordingToCloud({
            blob,
            storagePath: 'users/u/recordings/r.webm',
            upload: async () => {},
            getDownloadUrl: async () => 'https://storage.example/r.webm',
            register: async (docId) => {
                registerCalls++;
                docIds.add(docId);
                // First write commits server-side but the response is lost.
                if (registerCalls === 1) throw new Error('network blip after commit');
            },
            newDocId: () => 'fixed-doc-id',
            sleep: noopSleep,
        });

        expect(registerCalls).toBe(2);
        expect(docIds.size).toBe(1);
        expect(result.docId).toBe('fixed-doc-id');
    });

    it('does not re-upload the blob when only the registration write failed', async () => {
        let uploadCalls = 0;

        await expect(
            syncRecordingToCloud({
                blob,
                storagePath: 'p',
                upload: async () => {
                    uploadCalls++;
                },
                getDownloadUrl: async () => 'https://storage.example/p',
                register: async () => {
                    throw new Error('write failed');
                },
                maxRetries: 3,
                sleep: noopSleep,
            }),
        ).rejects.toThrow('write failed');

        expect(uploadCalls).toBe(1);
    });

    it('retries uploads that fail before the first success', async () => {
        let uploadCalls = 0;

        const result = await syncRecordingToCloud({
            blob,
            storagePath: 'p',
            upload: async () => {
                uploadCalls++;
                if (uploadCalls < 2) throw new Error('upload failed');
            },
            getDownloadUrl: async () => 'https://storage.example/p',
            register: async () => {},
            maxRetries: 3,
            sleep: noopSleep,
        });

        expect(uploadCalls).toBe(2);
        expect(result.downloadUrl).toBe('https://storage.example/p');
    });

    it('gives up after maxRetries with exponential backoff between attempts', async () => {
        const sleep = vi.fn(noopSleep);

        await expect(
            syncRecordingToCloud({
                blob,
                storagePath: 'p',
                upload: async () => {
                    throw new Error('always fails');
                },
                getDownloadUrl: async () => 'https://storage.example/p',
                register: async () => {},
                maxRetries: DEFAULT_RECORDING_MAX_RETRIES,
                sleep,
            }),
        ).rejects.toThrow('always fails');

        expect(sleep).toHaveBeenCalledTimes(2);
        expect(sleep).toHaveBeenNthCalledWith(1, 1000);
        expect(sleep).toHaveBeenNthCalledWith(2, 2000);
    });

    it('falls back to a generated id when crypto.randomUUID is unavailable', async () => {
        const originalCrypto = globalThis.crypto;
        Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });

        try {
            const result = await syncRecordingToCloud({
                blob,
                storagePath: 'p',
                upload: async () => {},
                getDownloadUrl: async () => 'https://storage.example/p',
                register: async () => {},
                sleep: noopSleep,
            });

            expect(result.docId).toMatch(/^rec_/);
        } finally {
            Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
        }
    });
});
