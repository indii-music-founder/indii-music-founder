import { describe, expect, it } from 'vitest';
import {
  CatalogArtifactTypeSchema,
  CatalogImportIntentSchema,
  CatalogImportSessionSchema,
  planCatalogImport,
  reconcileCatalogFacts,
  type CatalogFact,
} from './catalogImport.js';

const now = '2026-09-22T12:00:00.000Z';
const provenance = { state: 'UNKNOWN' as const, sourceType: 'IMPORT' as const, sourceId: 'import:file-1', evidence: [], observedAt: now };
const fact = (overrides: Partial<CatalogFact> = {}): CatalogFact => ({
  factId: 'imported-title', entityId: 'recording:internal-1', fieldPath: 'recording.title',
  value: 'The Song', authority: 'REFERENCE', provenance, ...overrides,
});

describe('existing catalog intelligence', () => {
  it('supports every approved existing-catalog intent', () => {
    expect(CatalogImportIntentSchema.options).toHaveLength(7);
  });

  it('accepts every approved catalog artifact type', () => {
    expect(CatalogArtifactTypeSchema.options).toEqual(expect.arrayContaining([
      'MASTER_AUDIO', 'METADATA', 'ARTWORK', 'IDENTIFIER', 'ROYALTY_STATEMENT',
      'REGISTRATION', 'SPLIT_SHEET', 'LICENSE', 'VIDEO', 'DISTRIBUTION_HISTORY',
    ]));
  });

  it('proposes a new reference fact without applying it', () => {
    const result = reconcileCatalogFacts([], [fact()], now);
    expect(result.items[0]).toMatchObject({ disposition: 'PROPOSED', requiresHumanReview: false });
  });

  it('requires review for a new authoritative identifier', () => {
    const result = reconcileCatalogFacts([], [fact({ fieldPath: 'identifiers.ISRC', value: 'US-AAA-26-00001', authority: 'AUTHORITATIVE' })], now);
    expect(result.items[0]).toMatchObject({ disposition: 'REVIEW_REQUIRED', requiresHumanReview: true });
  });

  it('requires review and preserves both values when facts conflict', () => {
    const existing = fact({ factId: 'existing-title' });
    const imported = fact({ value: 'Different Song' });
    const result = reconcileCatalogFacts([existing], [imported], now);
    expect(result.hasConflicts).toBe(true);
    expect(result.items[0]).toMatchObject({ existingValue: 'The Song', importedValue: 'Different Song', disposition: 'REVIEW_REQUIRED' });
    expect(existing.value).toBe('The Song');
  });

  it('records agreement without manufacturing a conflict', () => {
    const result = reconcileCatalogFacts([fact({ factId: 'existing' })], [fact()], now);
    expect(result.items[0].disposition).toBe('AGREEMENT');
    expect(result.readyForHumanReview).toBe(false);
  });

  it('compares object facts deterministically regardless of key order', () => {
    const result = reconcileCatalogFacts(
      [fact({ factId: 'existing', value: { artist: 'A', title: 'T' } })],
      [fact({ value: { title: 'T', artist: 'A' } })], now,
    );
    expect(result.items[0].disposition).toBe('AGREEMENT');
  });

  it('keeps external identifiers separate from canonical identity', () => {
    const imported = fact({ entityId: 'release:internal-9', fieldPath: 'identifiers.UPC', value: '012345678905', authority: 'AUTHORITATIVE' });
    const result = reconcileCatalogFacts([], [imported], now);
    expect(result.items[0].entityId).toBe('release:internal-9');
    expect(result.items[0].importedValue).toBe('012345678905');
  });

  it('moves a session to review-required without applying changes', () => {
    const session = CatalogImportSessionSchema.parse({
      schemaVersion: 'catalog-import.v1', importId: 'import-1', ownerUid: 'user-1',
      intent: 'MOVE_DISTRIBUTOR', artifacts: [], importedFacts: [fact({ authority: 'LEGAL' })],
      createdAt: now, updatedAt: now,
    });
    const planned = planCatalogImport(session, [], '2026-09-22T12:01:00.000Z');
    expect(planned.status).toBe('REVIEW_REQUIRED');
    expect(session.status).toBe('COLLECTING');
  });

  it('rejects applied sessions while review remains unresolved', () => {
    expect(() => CatalogImportSessionSchema.parse({
      schemaVersion: 'catalog-import.v1', importId: 'import-1', ownerUid: 'user-1',
      intent: 'RE_RELEASE', artifacts: [], importedFacts: [], status: 'APPLIED',
      reconciliation: reconcileCatalogFacts([], [fact({ authority: 'LEGAL' })], now),
      createdAt: now, updatedAt: now,
    })).toThrow(/human review/i);
  });
});
