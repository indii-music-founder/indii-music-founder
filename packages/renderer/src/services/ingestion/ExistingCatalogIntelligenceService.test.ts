import { describe, expect, it } from 'vitest';
import type { CatalogFact, CatalogImportSession } from '@indii/shared';
import { INITIAL_METADATA } from '@/services/metadata/types';
import type { CatalogTrack } from '@/modules/registration/types';
import { ExistingCatalogIntelligenceService } from './ExistingCatalogIntelligenceService';

const now = '2026-09-22T12:00:00.000Z';
const provenance = { state: 'UNKNOWN' as const, sourceType: 'IMPORT' as const, sourceId: 'statement-1', evidence: [], observedAt: now };

describe('ExistingCatalogIntelligenceService', () => {
    it('surfaces legacy identifier collisions to Registration Center without upgrading their truth state', () => {
        const service = new ExistingCatalogIntelligenceService();
        const track = (id: string): CatalogTrack => ({
            id,
            title: `Track ${id}`,
            artistName: 'Artist',
            writersAndContributors: [],
            isrc: 'USAAA2600001',
            isPublished: false,
        });

        const report = service.analyzeRegistrationCatalog('legacy-catalog:user-1', [track('legacy-a'), track('legacy-b')], now);

        expect(report.snapshot.completeness).toBe('UNKNOWN');
        expect(report.findings).toHaveLength(1);
        expect(report.findings[0]).toMatchObject({
            code: 'DUPLICATE_ACTIVE_IDENTIFIER',
            severity: 'REVIEW_REQUIRED',
            provenanceStates: ['UNKNOWN'],
            explanation: expect.stringContaining('no entities were merged'),
        });
        expect(report.findings[0]?.entityIds).toEqual([
            'legacy-track:legacy-a:recording',
            'legacy-track:legacy-b:recording',
        ]);
        expect(report.findings[0]).not.toHaveProperty('identifierValue');
    });

    it('bounds very large registration catalogs and marks the analyzed snapshot partial', () => {
        const service = new ExistingCatalogIntelligenceService();
        const tracks: CatalogTrack[] = Array.from({ length: 5_001 }, (_, index) => ({
            id: `legacy-${String(index).padStart(5, '0')}`,
            title: `Track ${index}`,
            artistName: 'Artist',
            writersAndContributors: [],
            isPublished: false,
        }));

        const report = service.analyzeRegistrationCatalog('legacy-catalog:user-1', tracks, now);

        expect(report.snapshot.completeness).toBe('PARTIAL');
        expect(report.metrics.entityCount).toBe(10_000);
    });

    it('attaches a review plan without mutating golden metadata', () => {
        const service = new ExistingCatalogIntelligenceService();
        const metadata = { ...INITIAL_METADATA, trackTitle: 'Existing Song' };
        const imported: CatalogFact = {
            factId: 'import-title', entityId: 'recording:internal-1', fieldPath: 'recording.title',
            value: 'Imported Song', authority: 'REFERENCE', provenance,
        };
        const existing: CatalogFact = { ...imported, factId: 'existing-title', value: 'Existing Song' };
        const session: CatalogImportSession = {
            schemaVersion: 'catalog-import.v1', importId: 'import-1', ownerUid: 'user-1',
            intent: 'CLEAN_CATALOG', artifacts: [], importedFacts: [imported], status: 'COLLECTING',
            createdAt: now, updatedAt: now,
        };

        const result = service.planImport(metadata, session, [existing], now);

        expect(result.catalogImport?.status).toBe('REVIEW_REQUIRED');
        expect(result.catalogImport?.reconciliation?.items[0]).toMatchObject({
            existingValue: 'Existing Song', importedValue: 'Imported Song', disposition: 'REVIEW_REQUIRED',
        });
        expect(metadata).not.toHaveProperty('catalogImport');
        expect(result.trackTitle).toBe('Existing Song');
    });
});
