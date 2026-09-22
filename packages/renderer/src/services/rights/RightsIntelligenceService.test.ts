import { describe, expect, it } from 'vitest';
import type { RightsIntelligenceInput } from '@indii/shared';
import { INITIAL_METADATA } from '@/services/metadata/types';
import { RightsIntelligenceService } from './RightsIntelligenceService';

describe('RightsIntelligenceService', () => {
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
});
