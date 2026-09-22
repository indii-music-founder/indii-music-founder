import {
    evaluateRightsIntelligence,
    type RightsIntelligenceInput,
} from '@indii/shared';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

/** Adds a deterministic preflight to the existing release metadata object. */
export class RightsIntelligenceService {
    evaluate(
        metadata: ExtendedGoldenMetadata,
        input: RightsIntelligenceInput,
        evaluatedAt = new Date().toISOString(),
    ): ExtendedGoldenMetadata {
        return {
            ...metadata,
            rightsIntelligence: evaluateRightsIntelligence(input, evaluatedAt),
        };
    }
}

export const rightsIntelligenceService = new RightsIntelligenceService();
