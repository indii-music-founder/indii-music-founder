import { describe, expect, it } from 'vitest';
import type { RightsIntelligenceInput } from '@indii/shared';
import { INITIAL_METADATA } from '@/services/metadata/types';
import { RightsIntelligenceService } from './RightsIntelligenceService';

describe('RightsIntelligenceService', () => {
    it('exposes the canonical claims inbox through the existing rights service', () => {
        const now = '2026-09-22T13:00:00.000Z';
        const provenance = { state: 'USER_DECLARED' as const, sourceType: 'USER' as const, evidence: [], observedAt: now };
        const claim = {
            schemaVersion: 'rights-claim.v1' as const, id: 'claim:1', targetEntityId: 'recording:1',
            claimantEntityId: 'person:1', type: 'MASTER' as const, status: 'ASSERTED' as const,
            territoryCodes: [], provenance, createdAt: now, updatedAt: now,
        };
        const inbox = new RightsIntelligenceService().projectClaims({ claims: [claim], events: [], evaluatedAt: now });

        expect(inbox.schemaVersion).toBe('claims-inbox.v1');
        expect(inbox.items[0]).toMatchObject({
            claim: { id: 'claim:1', status: 'ASSERTED' },
            queueStatus: 'REVIEW_REQUIRED',
            requiresHumanReview: true,
        });
        expect(inbox.items[0]?.claim.status).toBe('ASSERTED');
    });

    it('attaches a rights preflight without mutating existing release metadata', () => {
        const now = '2026-09-22T13:00:00.000Z';
        const metadata = { ...INITIAL_METADATA, trackTitle: 'Rights Song' };
        const input: RightsIntelligenceInput = {
            targetEntityId: 'recording:1', interests: [], thirdPartyUses: [], grants: [], evidenceVaults: [],
        };
        const result = new RightsIntelligenceService().evaluate(metadata, input, now);
        expect(result.rightsIntelligence).toMatchObject({ targetEntityId: 'recording:1', releaseReviewRequired: true });
        expect(result.trackTitle).toBe('Rights Song');
        expect(metadata).not.toHaveProperty('rightsIntelligence');
    });

    it('keeps rights readiness blocked until a catalog import is explicitly applied', () => {
        const now = '2026-09-22T13:00:00.000Z';
        const metadata = {
            ...INITIAL_METADATA,
            catalogImport: {
                schemaVersion: 'catalog-import.v1' as const,
                importId: 'import-1', ownerUid: 'user-1', intent: 'IMPORT_OLD_RELEASE' as const,
                artifacts: [], importedFacts: [], status: 'REVIEW_REQUIRED' as const,
                createdAt: now, updatedAt: now,
            },
        };
        const input: RightsIntelligenceInput = {
            targetEntityId: 'recording:1', interests: [], thirdPartyUses: [], grants: [], evidenceVaults: [],
        };

        const result = new RightsIntelligenceService().evaluate(metadata, input, now);

        expect(result.rightsIntelligence?.findings).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'CATALOG_IMPORT_UNRESOLVED', severity: 'BLOCKING', requiresHumanReview: true }),
        ]));
        expect(result.rightsIntelligence?.releaseReviewRequired).toBe(true);
        expect(result.rightsIntelligence?.contentIdAutomaticSubmissionEligible).toBe(false);
    });
});
