import {
    planCatalogImport,
    type CatalogFact,
    type CatalogImportSession,
} from '@indii/shared';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

/**
 * Phase 5 boundary for the existing metadata/DDEX pipeline.
 * Produces a review plan only; persistence and acceptance remain explicit
 * human-controlled steps in the existing workflow.
 */
export class ExistingCatalogIntelligenceService {
    planImport(
        metadata: ExtendedGoldenMetadata,
        session: CatalogImportSession,
        existingFacts: readonly CatalogFact[],
        generatedAt = new Date().toISOString(),
    ): ExtendedGoldenMetadata {
        return {
            ...metadata,
            catalogImport: planCatalogImport(session, existingFacts, generatedAt),
        };
    }
}

export const existingCatalogIntelligenceService = new ExistingCatalogIntelligenceService();
