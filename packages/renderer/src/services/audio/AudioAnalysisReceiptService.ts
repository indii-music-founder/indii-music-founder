import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';

import { db } from '@/services/firebase';
import { Logger } from '@/core/logger/Logger';
import type { MasterAudioReference } from '@/services/metadata/types';

export type AudioAnalysisReceiptStatus = 'processing' | 'complete' | 'failed';

export interface AudioAnalysisReceipt {
    receiptId: string;
    userId: string;
    contentHash: string;
    generation: string;
    masterFingerprint: string;
    status: AudioAnalysisReceiptStatus;
    technical?: {
        container: 'wav' | 'flac';
        codec: string;
        sampleRate: number;
        bitDepth: number;
        channels: number;
        frames: number;
        durationSeconds: number;
        sizeBytes: number;
    };
    openSourceProfile?: Record<string, unknown>;
    geminiProfile?: Record<string, unknown>;
    geminiModel?: string;
    failureType?: string;
    failureMessage?: string;
}

function isReceiptStatus(value: unknown): value is AudioAnalysisReceiptStatus {
    return value === 'processing' || value === 'complete' || value === 'failed';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : undefined;
}

/**
 * Converts the worker's stable owner/hash/generation identity into its
 * Firestore document ID. This must stay byte-for-byte aligned with
 * `engine-dsp/pipeline.py::_receipt_id`; it deliberately contains no audio
 * content and never exposes an enumerable collection query.
 */
export async function canonicalReceiptId(
    userId: string,
    contentHash: string,
    generation: string,
): Promise<string> {
    if (!userId.trim() || !/^[a-f0-9]{64}$/.test(contentHash) || !/^[1-9][0-9]{0,29}$/.test(generation)) {
        throw new Error('Invalid canonical-master receipt identity.');
    }
    const bytes = new TextEncoder().encode(`${userId}\0${contentHash}\0${generation}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    return `audio_${hash.slice(0, 48)}`;
}

export function parseAudioAnalysisReceipt(
    receiptId: string,
    data: unknown,
    expected: Pick<AudioAnalysisReceipt, 'userId' | 'contentHash' | 'generation'>,
): AudioAnalysisReceipt {
    const value = asRecord(data);
    if (!value || value.userId !== expected.userId || value.contentHash !== expected.contentHash || String(value.generation) !== expected.generation) {
        throw new Error('Analysis receipt identity does not match the canonical master.');
    }
    if (!isReceiptStatus(value.status)) {
        throw new Error('Analysis receipt has an invalid status.');
    }
    return {
        receiptId,
        userId: expected.userId,
        contentHash: expected.contentHash,
        generation: expected.generation,
        masterFingerprint: typeof value.masterFingerprint === 'string' ? value.masterFingerprint : '',
        status: value.status,
        technical: asRecord(value.technical) as AudioAnalysisReceipt['technical'],
        openSourceProfile: asRecord(value.openSourceProfile),
        geminiProfile: asRecord(value.geminiProfile),
        geminiModel: typeof value.geminiModel === 'string' ? value.geminiModel : undefined,
        failureType: typeof value.failureType === 'string' ? value.failureType : undefined,
        failureMessage: typeof value.failureMessage === 'string' ? value.failureMessage : undefined,
    };
}

export class AudioAnalysisReceiptService {
    async waitForTerminalReceipt(
        master: Pick<MasterAudioReference, 'contentHash' | 'generation'>,
        userId: string,
        timeoutMs = 20 * 60 * 1000,
        signal?: AbortSignal,
    ): Promise<AudioAnalysisReceipt> {
        return new Promise((resolve, reject) => {
            let unsubscribe: Unsubscribe | undefined;
            let settled = false;
            const finish = (callback: () => void) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeout);
                if (signal) {
                    signal.removeEventListener('abort', onAbort);
                }
                unsubscribe?.();
                callback();
            };
            const onAbort = () => {
                finish(() => reject(new DOMException('Aborted', 'AbortError')));
            };
            if (signal) {
                if (signal.aborted) {
                    return reject(new DOMException('Aborted', 'AbortError'));
                }
                signal.addEventListener('abort', onAbort);
            }
            const timeout = window.setTimeout(() => {
                finish(() => reject(new Error('Canonical-master analysis is still processing. You can safely return and retry; the server job remains durable.')));
            }, timeoutMs);
            this.watch(master, userId, receipt => {
                if (receipt.status === 'processing') return;
                if (receipt.status === 'failed') {
                    finish(() => reject(new Error(`Canonical-master analysis failed: ${receipt.failureMessage || receipt.failureType || 'unknown worker failure'}`)));
                    return;
                }
                finish(() => resolve(receipt));
            }, error => {
                finish(() => reject(error));
            }).then(listener => {
                unsubscribe = listener;
                // `onSnapshot` may synchronously invoke its callback in a test
                // or cached/offline state before this Promise resolves.
                if (settled) unsubscribe();
            }).catch(error => finish(() => reject(error)));
        });
    }

    async watch(
        master: Pick<MasterAudioReference, 'contentHash' | 'generation'>,
        userId: string,
        onReceipt: (receipt: AudioAnalysisReceipt) => void,
        onError: (error: Error) => void,
    ): Promise<Unsubscribe> {
        if (!master.generation) {
            throw new Error('This legacy master has no immutable Storage generation and cannot be matched to a server analysis receipt.');
        }
        const receiptId = await canonicalReceiptId(userId, master.contentHash, master.generation);
        const expected = { userId, contentHash: master.contentHash, generation: master.generation };
        return onSnapshot(doc(db, 'audio_analysis_receipts', receiptId), snapshot => {
            if (!snapshot.exists()) return;
            try {
                onReceipt(parseAudioAnalysisReceipt(receiptId, snapshot.data(), expected));
            } catch (error) {
                const safeError = error instanceof Error ? error : new Error('Invalid audio-analysis receipt.');
                Logger.error('AudioAnalysisReceipt', safeError.message);
                onError(safeError);
            }
        }, error => onError(new Error(`Unable to read protected audio-analysis receipt: ${error.message}`)));
    }
}

export const audioAnalysisReceiptService = new AudioAnalysisReceiptService();
