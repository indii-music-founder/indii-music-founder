import { describe, expect, it, vi } from 'vitest';
import { httpsCallable } from 'firebase/functions';

const mocks = vi.hoisted(() => ({ callable: vi.fn() }));

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => mocks.callable) }));
vi.mock('@/services/firebase', () => ({ functions: {} }));

import { loadCanonicalCatalogIntelligence } from './CanonicalCatalogIntelligence';

describe('loadCanonicalCatalogIntelligence', () => {
    it('requests a user-scoped report and validates the returned report contract', async () => {
        mocks.callable.mockResolvedValue({
            data: {
                schemaVersion: 'catalog-intelligence.v1',
                snapshot: { catalogId: 'canonical:user:owner-1', completeness: 'UNKNOWN' },
                metrics: { entityCount: 0, identifierCount: 0, relationshipCount: 0, findingCount: 0 },
                findings: [],
                unassessedChecks: [],
                evaluatedAt: '2026-09-25T12:00:00.000Z',
            },
        });

        const report = await loadCanonicalCatalogIntelligence('owner-1');

        expect(httpsCallable).toHaveBeenCalledWith(
            expect.anything(),
            'getCanonicalMusicCatalogIntelligence',
        );
        expect(mocks.callable).toHaveBeenCalledWith({ scope: { kind: 'user', id: 'owner-1' } });
        expect(report.snapshot.completeness).toBe('UNKNOWN');
    });

    it('rejects invalid report responses instead of showing unvalidated findings', async () => {
        mocks.callable.mockResolvedValue({ data: { findings: [{ owner: true }] } });

        await expect(loadCanonicalCatalogIntelligence('owner-1')).rejects.toThrow();
    });

    it('does not call the backend without a user identity', async () => {
        await expect(loadCanonicalCatalogIntelligence(' ')).rejects.toThrow('authenticated user');
        expect(httpsCallable).not.toHaveBeenCalled();
    });
});
