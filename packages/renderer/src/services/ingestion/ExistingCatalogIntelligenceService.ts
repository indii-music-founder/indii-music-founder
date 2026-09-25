import {
    analyzeCatalogIntelligence,
    planCatalogImport,
    projectLegacyTrackToCanonical,
    type CatalogIntelligenceReport,
    type CatalogFact,
    type CatalogImportSession,
} from '@indii/shared';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
import type { CatalogTrack } from '@/modules/registration/types';

/**
 * Phase 5 boundary for the existing metadata/DDEX pipeline.
 * Produces a review plan only; persistence and acceptance remain explicit
 * human-controlled steps in the existing workflow.
 */
export class ExistingCatalogIntelligenceService {
    /**
     * Read-only diagnostics for the existing Registration Center catalog.
     * Legacy rows are projected in memory through the shared compatibility
     * adapter; no row is persisted or treated as confirmed canonical truth.
     */
    analyzeRegistrationCatalog(
        catalogId: string,
        tracks: readonly CatalogTrack[],
        evaluatedAt = new Date().toISOString(),
    ): CatalogIntelligenceReport {
        const maxTracks = 5_000;
        const boundedTracks = [...tracks].sort((left, right) => left.id.localeCompare(right.id)).slice(0, maxTracks);
        const entities = [];
        const identifiers = [];
        for (const track of boundedTracks) {
            const projection = projectLegacyTrackToCanonical({
                id: track.id,
                title: track.title,
                artistName: track.artistName,
                isrc: track.isrc,
                iswc: track.iswc,
                durationSeconds: track.duration,
            }, evaluatedAt);
            entities.push(projection.recording, projection.musicalWork);
            identifiers.push(...projection.identifiers);
        }

        return analyzeCatalogIntelligence({
            snapshot: { catalogId, completeness: tracks.length > maxTracks ? 'PARTIAL' : 'UNKNOWN' },
            entities,
            identifiers,
            relationships: [],
            evaluatedAt,
        });
    }

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
