import { describe, expect, it, vi } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

import type { CanonicalMusicCatalogStore } from './canonicalMusicCatalogStore';
import { resolveClaimsInbox, resolveDeclareRightsClaim } from './claimsInbox';

function request(data: unknown): CallableRequest<unknown> {
    return { data } as CallableRequest<unknown>;
}

describe('canonical claims inbox callables', () => {
    it('loads only the admitted owner scope from the server store', async () => {
        const snapshot = { claims: [], events: [], evaluatedAt: '2026-10-01T12:00:00.000Z', storageTruncated: false };
        const readClaimsInboxInput = vi.fn().mockResolvedValue(snapshot);
        const store = { readClaimsInboxInput } as unknown as CanonicalMusicCatalogStore;
        const admit = vi.fn().mockResolvedValue('owner-1');

        await expect(resolveClaimsInbox(request({ scope: { kind: 'user', id: 'owner-1' } }), { store, admit }))
            .resolves.toEqual(snapshot);
        expect(readClaimsInboxInput).toHaveBeenCalledWith('owner-1', { kind: 'user', id: 'owner-1' });
    });

    it('creates an immutable owner-declared assertion and forces human-review provenance', async () => {
        const appendUserDeclaredClaim = vi.fn().mockImplementation(async (_uid, _scope, claim) => ({
            claim,
            event: {
                schemaVersion: 'music-domain-event.v1',
                eventId: `claim-received:${claim.id}`,
                eventType: 'claim.received',
                subject: { entityId: claim.id, entityType: 'rights_claim' },
                relatedEntities: [],
                occurredAt: claim.createdAt,
                recordedAt: claim.updatedAt,
                details: { intake: 'owner-declared', targetEntityId: claim.targetEntityId },
                provenance: claim.provenance,
            },
        }));
        const store = { appendUserDeclaredClaim } as unknown as CanonicalMusicCatalogStore;
        const admit = vi.fn().mockResolvedValue('owner-1');
        const now = () => new Date('2026-10-01T12:00:00.000Z');
        const createId = () => 'stable-test-id';

        const result = await resolveDeclareRightsClaim(request({
            scope: { kind: 'user', id: 'owner-1' },
            targetEntityId: 'recording:internal-1',
            claimantEntityId: 'person:owner-1',
            type: 'MASTER',
            territoryCodes: ['US'],
            evidence: [{ id: 'evidence-1', type: 'AGREEMENT', description: 'Signed split sheet' }],
        }), { store, admit, now, createId });

        expect(result.claim).toMatchObject({
            id: 'claim:stable-test-id',
            status: 'ASSERTED',
            provenance: {
                state: 'USER_DECLARED',
                sourceType: 'USER',
                sourceId: 'owner-1',
                evidence: [{ id: 'evidence-1', type: 'AGREEMENT' }],
            },
        });
        expect(result.event).toMatchObject({ eventType: 'claim.received', subject: { entityId: result.claim.id, entityType: 'rights_claim' } });
        expect(appendUserDeclaredClaim).toHaveBeenCalledWith('owner-1', { kind: 'user', id: 'owner-1' }, result.claim);
    });

    it('does not reach the store when admission fails or the target uses an external identifier', async () => {
        const appendUserDeclaredClaim = vi.fn();
        const store = { appendUserDeclaredClaim } as unknown as CanonicalMusicCatalogStore;
        await expect(resolveDeclareRightsClaim(request({
            scope: { kind: 'user', id: 'owner-1' },
            targetEntityId: 'recording:1',
            type: 'MASTER',
        }), { store, admit: vi.fn().mockRejectedValue(new Error('denied')) }))
            .rejects.toThrow('denied');
        expect(appendUserDeclaredClaim).not.toHaveBeenCalled();

        await expect(resolveDeclareRightsClaim(request({
            scope: { kind: 'user', id: 'owner-1' },
            targetEntityId: 'USABC2600001',
            type: 'MASTER',
        }), { store, admit: vi.fn().mockResolvedValue('owner-1') }))
            .rejects.toMatchObject({ code: 'invalid-argument' });
        expect(appendUserDeclaredClaim).not.toHaveBeenCalled();
    });
});
