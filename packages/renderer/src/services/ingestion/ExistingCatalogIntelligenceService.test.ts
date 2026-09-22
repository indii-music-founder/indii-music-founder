import { describe, expect, it } from 'vitest';
import type { CatalogFact, CatalogImportSession } from '@indii/shared';
import { INITIAL_METADATA } from '@/services/metadata/types';
import { ExistingCatalogIntelligenceService } from './ExistingCatalogIntelligenceService';

const now = '2026-09-22T12:00:00.000Z';
const provenance = { state: 'UNKNOWN' as const, sourceType: 'IMPORT' as const, sourceId: 'statement-1', evidence: [], observedAt: now };

describe('ExistingCatalogIntelligenceService', () => {
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
