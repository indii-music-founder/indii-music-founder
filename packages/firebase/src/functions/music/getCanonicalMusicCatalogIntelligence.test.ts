import { describe, expect, it, vi } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { CanonicalMusicCatalogStore } from './canonicalMusicCatalogStore';
import { resolveCanonicalMusicCatalogIntelligence } from './getCanonicalMusicCatalogIntelligence';

const input = {
    snapshot: { catalogId: 'canonical:user:owner-1', completeness: 'UNKNOWN' as const },
    entities: [],
    identifiers: [],
    relationships: [],
    evaluatedAt: '2026-09-25T12:00:00.000Z',
};

function request(data: unknown): CallableRequest<unknown> {
    return { data } as CallableRequest<unknown>;
}

describe('getCanonicalMusicCatalogIntelligence', () => {
    it('uses authenticated admission and returns a deterministic, non-authoritative report', async () => {
        const admit = vi.fn().mockResolvedValue('owner-1');
        const store = {
            readCatalogIntelligenceInput: vi.fn().mockResolvedValue(input),
        } as unknown as CanonicalMusicCatalogStore;

        const report = await resolveCanonicalMusicCatalogIntelligence(
            request({ scope: { kind: 'user', id: 'owner-1' } }),
            { admit, store },
        );

        expect(admit).toHaveBeenCalledWith(
            expect.objectContaining({ data: { scope: { kind: 'user', id: 'owner-1' } } }),
            'canonical-music-catalog-intelligence-read',
        );
        expect(store.readCatalogIntelligenceInput).toHaveBeenCalledWith(
            'owner-1',
            { kind: 'user', id: 'owner-1' },
        );
        expect(report).toMatchObject({
            schemaVersion: 'catalog-intelligence.v1',
            snapshot: { completeness: 'UNKNOWN' },
            metrics: { entityCount: 0, identifierCount: 0, relationshipCount: 0, findingCount: 0 },
        });
        expect(report.findings).toEqual([]);
    });

    it('rejects malformed or extra request fields before admission', async () => {
        const admit = vi.fn().mockResolvedValue('owner-1');
        const store = { readCatalogIntelligenceInput: vi.fn().mockResolvedValue(input) } as unknown as CanonicalMusicCatalogStore;

        await expect(resolveCanonicalMusicCatalogIntelligence(
            request({ scope: { kind: 'user', id: 'owner-1' }, confirmed: true }),
            { admit, store },
        )).rejects.toMatchObject({ code: 'invalid-argument' });
        expect(admit).not.toHaveBeenCalled();
        expect(store.readCatalogIntelligenceInput).not.toHaveBeenCalled();
    });

    it('does not turn a denied admission into catalog access', async () => {
        const store = { readCatalogIntelligenceInput: vi.fn().mockResolvedValue(input) } as unknown as CanonicalMusicCatalogStore;

        await expect(resolveCanonicalMusicCatalogIntelligence(
            request({ scope: { kind: 'user', id: 'owner-1' } }),
            {
                admit: vi.fn().mockRejectedValue(new Error('admission denied')),
                store,
            },
        )).rejects.toThrow('admission denied');
        expect(store.readCatalogIntelligenceInput).not.toHaveBeenCalled();
    });
});
