import { describe, expect, it } from 'vitest';
import {
  analyzeCatalogIntelligence,
  CatalogIntelligenceInputSchema,
  type CatalogIntelligenceInput,
} from './catalogIntelligence.js';
import type { CanonicalMusicEntity, MusicIdentifier } from './musicEntity.js';
import type { MusicRelationship } from './musicRelationship.js';

const now = '2026-09-24T20:00:00.000Z';
const provenance = {
  state: 'USER_DECLARED' as const,
  sourceType: 'USER' as const,
  sourceId: 'source:catalog-fixture',
  evidence: [{ id: 'evidence:catalog-fixture', type: 'EXTERNAL_RECORD' as const }],
  observedAt: now,
};

function entity(id: string, entityType: 'sound_recording' | 'release' = 'sound_recording'): CanonicalMusicEntity {
  if (entityType === 'release') {
    return {
      schemaVersion: 'canonical-music-entity.v1', id, entityType,
      title: `Release ${id}`, releaseType: 'SINGLE', createdAt: now, updatedAt: now,
      provenance,
    };
  }
  return {
    schemaVersion: 'canonical-music-entity.v1', id, entityType,
    title: `Recording ${id}`, recordingKind: 'ORIGINAL', createdAt: now, updatedAt: now,
    provenance,
  };
}

function identifier(overrides: Partial<MusicIdentifier> & Pick<MusicIdentifier, 'id' | 'entityId' | 'value'>): MusicIdentifier {
  return {
    id: overrides.id,
    entityId: overrides.entityId,
    type: overrides.type ?? 'ISRC',
    value: overrides.value,
    ...(overrides.namespace ? { namespace: overrides.namespace } : {}),
    status: overrides.status ?? 'ACTIVE',
    provenance: overrides.provenance ?? provenance,
  };
}

function relationship(overrides: Partial<MusicRelationship> & Pick<MusicRelationship, 'id' | 'fromEntityId' | 'toEntityId'>): MusicRelationship {
  return {
    schemaVersion: 'music-relationship.v1',
    id: overrides.id,
    fromEntityId: overrides.fromEntityId,
    toEntityId: overrides.toEntityId,
    type: overrides.type ?? 'INCLUDED_ON',
    status: overrides.status ?? 'ACTIVE',
    territoryCodes: overrides.territoryCodes ?? [],
    attributes: overrides.attributes ?? {},
    provenance: overrides.provenance ?? provenance,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function input(overrides: Partial<CatalogIntelligenceInput> = {}): CatalogIntelligenceInput {
  return {
    snapshot: { catalogId: 'catalog:owner-1', completeness: 'COMPLETE' },
    entities: [entity('recording:a'), entity('recording:b'), entity('release:r', 'release')],
    identifiers: [],
    relationships: [],
    evaluatedAt: now,
    ...overrides,
  };
}

describe('Phase 13 catalog intelligence', () => {
  it('finds normalized active-standard identifier reuse across canonical entities without merging them', () => {
    const result = analyzeCatalogIntelligence(input({
      identifiers: [
        identifier({ id: 'identifier:a', entityId: 'recording:a', value: 'us-aaa-26-00001' }),
        identifier({ id: 'identifier:b', entityId: 'recording:b', value: 'US AAA 26 00001', provenance: { ...provenance, state: 'DOCUMENTED' } }),
      ],
    }));
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      code: 'DUPLICATE_ACTIVE_IDENTIFIER',
      entityIds: ['recording:a', 'recording:b'],
      relatedRecordIds: ['identifier:a', 'identifier:b'],
      provenanceStates: ['DOCUMENTED', 'USER_DECLARED'],
      sourceIds: ['identifier:a', 'identifier:b'],
    });
    expect(result.findings[0]).not.toHaveProperty('identifierValue');
  });

  it('keeps namespaces and proprietary value case significant', () => {
    const result = analyzeCatalogIntelligence(input({
      identifiers: [
        identifier({ id: 'platform:a', entityId: 'recording:a', type: 'PLATFORM_ID', namespace: 'service-a', value: 'TrackA' }),
        identifier({ id: 'platform:b', entityId: 'recording:b', type: 'PLATFORM_ID', namespace: 'service-b', value: 'TrackA' }),
        identifier({ id: 'prop:a', entityId: 'recording:a', type: 'PROPRIETARY', namespace: 'label', value: 'Catalog-X' }),
        identifier({ id: 'prop:b', entityId: 'recording:b', type: 'PROPRIETARY', namespace: 'label', value: 'catalog-x' }),
      ],
    }));
    expect(result.findings).toEqual([]);
  });

  it('surfaces repeated active records on one entity as a record issue, not an entity collision', () => {
    const result = analyzeCatalogIntelligence(input({
      identifiers: [
        identifier({ id: 'isrc:row-1', entityId: 'recording:a', value: 'USAAA2600001' }),
        identifier({ id: 'isrc:row-2', entityId: 'recording:a', value: 'US-AAA-26-00001' }),
      ],
    }));
    expect(result.findings[0]).toMatchObject({
      code: 'DUPLICATE_ACTIVE_IDENTIFIER_RECORD',
      entityIds: ['recording:a'],
      relatedRecordIds: ['isrc:row-1', 'isrc:row-2'],
    });
  });

  it('groups large repeated identifier sets without losing records or mutating the input', () => {
    const identifiers = Array.from({ length: 2_000 }, (_, index) => identifier({
      id: `identifier:bulk-${index}`,
      entityId: index % 2 === 0 ? 'recording:a' : 'recording:b',
      value: 'USAAA2600001',
    }));
    const result = analyzeCatalogIntelligence(input({ identifiers }));

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.code).toBe('DUPLICATE_ACTIVE_IDENTIFIER');
    expect(result.findings[0]?.relatedRecordIds).toHaveLength(2_000);
    expect(identifiers).toHaveLength(2_000);
    expect(identifiers[0]?.id).toBe('identifier:bulk-0');
  });

  it('does not turn disputed, unknown, or historical assignments into an active duplicate', () => {
    const result = analyzeCatalogIntelligence(input({
      identifiers: [
        identifier({ id: 'identifier:active', entityId: 'recording:a', value: 'USAAA2600001', status: 'ACTIVE' }),
        identifier({ id: 'identifier:disputed', entityId: 'recording:b', value: 'US-AAA-26-00001', status: 'DISPUTED', provenance: { ...provenance, state: 'DISPUTED' } }),
      ],
    }));
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ code: 'IDENTIFIER_ASSIGNMENT_REVIEW', severity: 'REVIEW_REQUIRED' });
    expect(result.findings[0]?.explanation).toMatch(/not classified as an active duplicate/i);
  });

  it('ignores a historical-only duplicate cluster but flags active/history overlap for review', () => {
    const historicalOnly = analyzeCatalogIntelligence(input({ identifiers: [
      identifier({ id: 'historical:a', entityId: 'recording:a', value: 'USAAA2600001', status: 'HISTORICAL' }),
      identifier({ id: 'historical:b', entityId: 'recording:b', value: 'US-AAA-26-00001', status: 'HISTORICAL' }),
    ] }));
    expect(historicalOnly.findings).toEqual([]);

    const overlap = analyzeCatalogIntelligence(input({ identifiers: [
      identifier({ id: 'active:a', entityId: 'recording:a', value: 'USAAA2600001', status: 'ACTIVE' }),
      identifier({ id: 'historical:b', entityId: 'recording:b', value: 'US-AAA-26-00001', status: 'HISTORICAL' }),
    ] }));
    expect(overlap.findings[0]?.code).toBe('IDENTIFIER_ASSIGNMENT_REVIEW');
  });

  it('reports unresolved identifier owners and both dangling relationship endpoints only for complete snapshots', () => {
    const result = analyzeCatalogIntelligence(input({
      identifiers: [identifier({ id: 'identifier:orphan', entityId: 'unresolved:recording', value: 'USAAA2600001' })],
      relationships: [relationship({ id: 'relationship:both-orphan', fromEntityId: 'missing:from', toEntityId: 'missing:to' })],
    }));
    expect(result.findings.map(finding => finding.code)).toEqual([
      'DANGLING_RELATIONSHIP_ENDPOINT', 'MISSING_IDENTIFIER_ENTITY',
    ]);
    expect(result.findings[0]).toMatchObject({ missingEndpoints: ['FROM', 'TO'], entityIds: ['missing:from', 'missing:to'] });
    expect(result.findings[1]).toMatchObject({ entityIds: ['unresolved:recording'], relatedRecordIds: ['identifier:orphan'] });
  });

  it('does not call references dangling when the caller declares the snapshot partial or unknown', () => {
    for (const completeness of ['PARTIAL', 'UNKNOWN'] as const) {
      const result = analyzeCatalogIntelligence(input({
        snapshot: { catalogId: 'catalog:owner-1', completeness },
        identifiers: [identifier({ id: `identifier:${completeness}`, entityId: 'outside:snapshot', value: 'USAAA2600001' })],
        relationships: [relationship({ id: `relationship:${completeness}`, fromEntityId: 'recording:a', toEntityId: 'outside:snapshot' })],
      }));
      expect(result.findings).toEqual([]);
      expect(result.unassessedChecks[0]?.code).toBe('DANGLING_REFERENCES');
    }
  });

  it('still reports observed duplicate identifiers in partial snapshots and labels their coverage', () => {
    const result = analyzeCatalogIntelligence(input({
      snapshot: { catalogId: 'catalog:owner-1', completeness: 'PARTIAL' },
      identifiers: [
        identifier({ id: 'identifier:a', entityId: 'recording:a', value: 'USAAA2600001' }),
        identifier({ id: 'identifier:b', entityId: 'recording:b', value: 'US-AAA-26-00001' }),
      ],
    }));
    expect(result.findings[0]?.code).toBe('DUPLICATE_ACTIVE_IDENTIFIER');
    expect(result.snapshot.completeness).toBe('PARTIAL');
    expect(result.unassessedChecks[0]?.code).toBe('DANGLING_REFERENCES');
  });

  it('is deterministic across input ordering and does not mutate caller-owned arrays', () => {
    const values = input({
      identifiers: [
        identifier({ id: 'identifier:b', entityId: 'recording:b', value: 'USAAA2600001' }),
        identifier({ id: 'identifier:a', entityId: 'recording:a', value: 'US-AAA-26-00001' }),
      ],
      relationships: [relationship({ id: 'relationship:missing', fromEntityId: 'missing:entity', toEntityId: 'release:r' })],
    });
    const reversed = { ...values, identifiers: [...values.identifiers].reverse(), relationships: [...values.relationships].reverse() };
    const first = analyzeCatalogIntelligence(values);
    const second = analyzeCatalogIntelligence(reversed);
    expect(first).toEqual(second);
    expect(values.identifiers[0]?.id).toBe('identifier:b');
    expect(values.relationships[0]?.id).toBe('relationship:missing');
  });

  it('makes the unassessed Phase 13 dimensions explicit instead of inventing requirements', () => {
    const report = analyzeCatalogIntelligence(input());
    expect(report.unassessedChecks.map(check => check.code)).toEqual(expect.arrayContaining([
      'MISSING_REGISTRATIONS', 'INCONSISTENT_CONTRIBUTOR_IDENTITIES', 'OWNERSHIP_GAPS',
      'DISCONNECTED_VIDEOS_ASSETS', 'MISSING_COLLECTION_PATHS', 'MULTI_WORK_CLAIM_PATTERNS',
    ]));
  });

  it('rejects duplicate canonical IDs and repeated row IDs before producing ambiguous findings', () => {
    expect(() => CatalogIntelligenceInputSchema.parse(input({ entities: [entity('recording:a'), entity('recording:a')] })))
      .toThrow(/Canonical entity IDs must be unique/);
    expect(() => CatalogIntelligenceInputSchema.parse(input({
      identifiers: [
        identifier({ id: 'identifier:duplicate', entityId: 'recording:a', value: 'USAAA2600001' }),
        identifier({ id: 'identifier:duplicate', entityId: 'recording:b', value: 'USAAA2600002' }),
      ],
    }))).toThrow(/Identifier record IDs must be unique/);
  });
});
