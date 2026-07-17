import { describe, expect, it } from 'vitest';

import { canonicalReceiptId, parseAudioAnalysisReceipt } from './AudioAnalysisReceiptService';

describe('AudioAnalysisReceiptService', () => {
    const identity = {
        userId: 'owner-1',
        contentHash: 'a'.repeat(64),
        generation: '987654321',
    };

    it('derives the same non-enumerable receipt identifier as the server worker', async () => {
        await expect(canonicalReceiptId(
            identity.userId,
            identity.contentHash,
            identity.generation,
        )).resolves.toBe('audio_d2b30fe2e4a166993bd7af13960c6deefc01af39868669a3');
    });

    it('rejects a receipt whose immutable identity does not match the requested master', () => {
        expect(() => parseAudioAnalysisReceipt('audio_test', {
            ...identity,
            contentHash: 'b'.repeat(64),
            status: 'complete',
        }, identity)).toThrow(/identity does not match/);
    });

    it('accepts only known worker statuses', () => {
        expect(() => parseAudioAnalysisReceipt('audio_test', {
            ...identity,
            status: 'invented',
        }, identity)).toThrow(/invalid status/);
    });
});
