'use client';

/**
 * Idempotent cloud sync for field recordings.
 *
 * The naive retry loop re-ran the whole pipeline on any failure, which
 * duplicates records: if the Firestore write committed but the response was
 * lost, the retry created a second history document. This helper fixes that
 * with two rules:
 *
 *  1. The Firestore document id is generated ONCE and reused on every
 *     attempt, so a retry overwrites the same document instead of adding a
 *     duplicate (setDoc semantics).
 *  2. The blob is only uploaded again when the previous upload never
 *     completed; a failure after upload (e.g. the registration write) skips
 *     the expensive re-upload and reuses the download URL.
 */

export const DEFAULT_RECORDING_MAX_RETRIES = 3;
export const DEFAULT_RECORDING_BASE_DELAY_MS = 1000;

export interface RecordingSyncDeps {
    blob: Blob;
    storagePath: string;
    maxRetries?: number;
    baseDelayMs?: number;
    upload: (storagePath: string, blob: Blob) => Promise<void>;
    getDownloadUrl: (storagePath: string) => Promise<string>;
    register: (docId: string, downloadUrl: string) => Promise<void>;
    newDocId?: () => string;
    sleep?: (ms: number) => Promise<void>;
}

export interface RecordingSyncResult {
    docId: string;
    downloadUrl: string;
}

function defaultNewDocId(): string {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
        return cryptoObj.randomUUID();
    }
    return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncRecordingToCloud(deps: RecordingSyncDeps): Promise<RecordingSyncResult> {
    const maxRetries = deps.maxRetries ?? DEFAULT_RECORDING_MAX_RETRIES;
    const baseDelayMs = deps.baseDelayMs ?? DEFAULT_RECORDING_BASE_DELAY_MS;
    const docId = deps.newDocId ? deps.newDocId() : defaultNewDocId();
    const sleep = deps.sleep ?? defaultSleep;

    let downloadUrl: string | null = null;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (downloadUrl === null) {
                await deps.upload(deps.storagePath, deps.blob);
                downloadUrl = await deps.getDownloadUrl(deps.storagePath);
            }
            await deps.register(docId, downloadUrl);
            return { docId, downloadUrl };
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                await sleep(baseDelayMs * 2 ** (attempt - 1));
            }
        }
    }

    throw lastError;
}
