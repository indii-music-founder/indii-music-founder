import { describe, expect, it, vi } from 'vitest';
import { AudioMatchEngine, KnownCatalogFingerprintProvider, type AudioMatchProvider } from './AudioMatchEngine';

describe('AudioMatchEngine', () => {
    it('aggregates provider evidence by confidence without asserting rights', async () => {
        const observedAt = '2026-09-22T13:00:00.000Z';
        const provider: AudioMatchProvider = {
            providerId: 'future-provider',
            match: vi.fn().mockResolvedValue([{ providerId: 'future-provider', candidateEntityId: 'recording:2', matchType: 'SIMILARITY', confidence: 0.72, provenance: { state: 'DETECTED', sourceType: 'EXTERNAL_SERVICE', sourceId: 'future-provider', evidence: [], observedAt } }]),
        };
        const results = await new AudioMatchEngine([provider]).match({ recordingEntityId: 'recording:1', fingerprint: 'SONIC-1' });
        expect(results[0]).toMatchObject({ confidence: 0.72, provenance: { state: 'DETECTED' } });
    });

    it('adapts exact matches from the existing known catalog', async () => {
        const provider = new KnownCatalogFingerprintProvider(vi.fn().mockResolvedValue('recording:2'));
        const results = await provider.match({ recordingEntityId: 'recording:1', fingerprint: 'SONIC-1' });
        expect(results[0]).toMatchObject({ candidateEntityId: 'recording:2', matchType: 'EXACT_FINGERPRINT', confidence: 1 });
    });

    it('does not report the same canonical recording as a match candidate', async () => {
        const provider = new KnownCatalogFingerprintProvider(vi.fn().mockResolvedValue('recording:1'));
        await expect(provider.match({ recordingEntityId: 'recording:1', fingerprint: 'SONIC-1' })).resolves.toEqual([]);
    });
});
