import { z } from 'zod';
import {
  CanonicalMusicEntitySchema,
  EvidenceReferenceSchema,
  MusicIdentifierSchema,
  MusicIdentifierStatusSchema,
  MusicIdentifierTypeSchema,
  ProvenanceStateSchema,
} from './musicEntity.js';
import { MusicRelationshipSchema, RelationshipStatusSchema } from './musicRelationship.js';

const IdSchema = z.string().trim().min(1).max(160);
const IsoDateTimeSchema = z.string().datetime();

export const CatalogSnapshotCompletenessSchema = z.enum(['COMPLETE', 'PARTIAL', 'UNKNOWN']);
export type CatalogSnapshotCompleteness = z.infer<typeof CatalogSnapshotCompletenessSchema>;

export const CatalogIntelligenceInputSchema = z.object({
  snapshot: z.object({
    catalogId: IdSchema,
    completeness: CatalogSnapshotCompletenessSchema,
  }).strict(),
  entities: z.array(CanonicalMusicEntitySchema).max(10_000),
  identifiers: z.array(MusicIdentifierSchema).max(100_000),
  relationships: z.array(MusicRelationshipSchema).max(50_000),
  evaluatedAt: IsoDateTimeSchema,
}).strict().superRefine((input, ctx) => {
  const checkUniqueIds = (ids: string[], path: string[], label: string) => {
    const seen = new Set<string>();
    for (const [index, id] of ids.entries()) {
      if (seen.has(id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...path, index], message: `${label} must be unique within a catalog snapshot.` });
      }
      seen.add(id);
    }
  };
  checkUniqueIds(input.entities.map(entity => entity.id), ['entities'], 'Canonical entity IDs');
  checkUniqueIds(input.identifiers.map(identifier => identifier.id), ['identifiers'], 'Identifier record IDs');
  checkUniqueIds(input.relationships.map(relationship => relationship.id), ['relationships'], 'Relationship IDs');
});
export type CatalogIntelligenceInput = z.infer<typeof CatalogIntelligenceInputSchema>;

export const CatalogIntelligenceFindingCodeSchema = z.enum([
  'DUPLICATE_ACTIVE_IDENTIFIER',
  'DUPLICATE_ACTIVE_IDENTIFIER_RECORD',
  'IDENTIFIER_ASSIGNMENT_REVIEW',
  'MISSING_IDENTIFIER_ENTITY',
  'DANGLING_RELATIONSHIP_ENDPOINT',
]);
export type CatalogIntelligenceFindingCode = z.infer<typeof CatalogIntelligenceFindingCodeSchema>;

export const CatalogIdentifierAssignmentSchema = z.object({
  identifierId: IdSchema,
  entityId: IdSchema,
  status: MusicIdentifierStatusSchema,
  provenanceState: ProvenanceStateSchema,
}).strict();

export const CatalogIntelligenceFindingSchema = z.object({
  findingId: IdSchema,
  code: CatalogIntelligenceFindingCodeSchema,
  severity: z.literal('REVIEW_REQUIRED'),
  catalogId: IdSchema,
  entityIds: z.array(IdSchema).max(100_000),
  relatedRecordIds: z.array(IdSchema).min(1).max(100_000),
  identifierType: MusicIdentifierTypeSchema.optional(),
  namespace: z.string().trim().min(1).max(256).optional(),
  identifierAssignments: z.array(CatalogIdentifierAssignmentSchema).max(100_000).optional(),
  relationshipStatus: RelationshipStatusSchema.optional(),
  missingEndpoints: z.array(z.enum(['FROM', 'TO'])).max(2).optional(),
  provenanceStates: z.array(ProvenanceStateSchema).max(100_000),
  sourceIds: z.array(IdSchema).max(100_000),
  evidence: z.array(EvidenceReferenceSchema).max(100_000),
  explanation: z.string().trim().min(1).max(1000),
  detectedAt: IsoDateTimeSchema,
}).strict();
export type CatalogIntelligenceFinding = z.infer<typeof CatalogIntelligenceFindingSchema>;

export const CatalogIntelligenceUnassessedCheckSchema = z.object({
  code: z.enum([
    'DANGLING_REFERENCES',
    'MISSING_REGISTRATIONS',
    'INCONSISTENT_CONTRIBUTOR_IDENTITIES',
    'OWNERSHIP_GAPS',
    'DISCONNECTED_VIDEOS_ASSETS',
    'MISSING_COLLECTION_PATHS',
    'MULTI_WORK_CLAIM_PATTERNS',
  ]),
  reason: z.string().trim().min(1).max(500),
}).strict();
export type CatalogIntelligenceUnassessedCheck = z.infer<typeof CatalogIntelligenceUnassessedCheckSchema>;

export const CatalogIntelligenceReportSchema = z.object({
  schemaVersion: z.literal('catalog-intelligence.v1'),
  snapshot: z.object({
    catalogId: IdSchema,
    completeness: CatalogSnapshotCompletenessSchema,
  }).strict(),
  metrics: z.object({
    entityCount: z.number().int().nonnegative(),
    identifierCount: z.number().int().nonnegative(),
    relationshipCount: z.number().int().nonnegative(),
    findingCount: z.number().int().nonnegative(),
  }).strict(),
  findings: z.array(CatalogIntelligenceFindingSchema).max(150_000),
  unassessedChecks: z.array(CatalogIntelligenceUnassessedCheckSchema).max(7),
  evaluatedAt: IsoDateTimeSchema,
}).strict().superRefine((report, ctx) => {
  if (report.metrics.findingCount !== report.findings.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['metrics', 'findingCount'], message: 'findingCount must match the emitted finding list.' });
  }
});
export type CatalogIntelligenceReport = z.infer<typeof CatalogIntelligenceReportSchema>;

const UNASSESSED_PHASE_13_CHECKS: readonly CatalogIntelligenceUnassessedCheck[] = [
  { code: 'MISSING_REGISTRATIONS', reason: 'No caller-declared registration requirement and territory scope was supplied; absence cannot be inferred.' },
  { code: 'INCONSISTENT_CONTRIBUTOR_IDENTITIES', reason: 'Names alone are not identity evidence; this audit does not merge or equate contributor entities.' },
  { code: 'OWNERSHIP_GAPS', reason: 'No rights, territory, time, or authoritative-claim scope was supplied; silence is not evidence of missing ownership.' },
  { code: 'DISCONNECTED_VIDEOS_ASSETS', reason: 'Media linkage is content- and use-specific; this audit does not treat any arbitrary relationship edge as a valid media connection.' },
  { code: 'MISSING_COLLECTION_PATHS', reason: 'No required collection, series, or release-hierarchy policy was supplied.' },
  { code: 'MULTI_WORK_CLAIM_PATTERNS', reason: 'Cross-work claim interpretation requires scoped rights assertions and explicit work-cluster semantics.' },
];

/**
 * Read-only deterministic catalog diagnostics. Findings never mutate canonical
 * identity, resolve a dispute, assert ownership, or apply imported facts.
 */
export function analyzeCatalogIntelligence(input: CatalogIntelligenceInput): CatalogIntelligenceReport {
  const parsed = CatalogIntelligenceInputSchema.parse(input);
  const entityIds = new Set(parsed.entities.map(entity => entity.id));
  const findings: CatalogIntelligenceFinding[] = [];
  const makeFindingId = (code: CatalogIntelligenceFindingCode, key: string) =>
    `catalog-integrity:${stableHash(JSON.stringify([parsed.snapshot.catalogId, code, key]))}`;
  const common = (sourceIds: string[], provenance: Array<{ state: CatalogIntelligenceFinding['provenanceStates'][number]; evidence: CatalogIntelligenceFinding['evidence'] }>) => ({
    provenanceStates: [...new Set(provenance.map(item => item.state))].sort(),
    sourceIds: [...new Set(sourceIds)].sort(),
    evidence: deduplicateEvidence(provenance.flatMap(item => item.evidence)),
    detectedAt: parsed.evaluatedAt,
    severity: 'REVIEW_REQUIRED' as const,
    catalogId: parsed.snapshot.catalogId,
  });

  const identifiersByIdentity = new Map<string, typeof parsed.identifiers>();
  for (const identifier of parsed.identifiers) {
    const key = identifierIdentityKey(identifier.type, identifier.namespace, identifier.value);
    const group = identifiersByIdentity.get(key);
    if (group) {
      group.push(identifier);
    } else {
      identifiersByIdentity.set(key, [identifier]);
    }
  }

  for (const [identityKey, group] of [...identifiersByIdentity.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const ordered = [...group].sort((left, right) => left.id.localeCompare(right.id));
    const assignedEntityIds = [...new Set(ordered.map(identifier => identifier.entityId))].sort();
    const active = ordered.filter(identifier => identifier.status === 'ACTIVE');
    const nonHistorical = ordered.filter(identifier => identifier.status !== 'HISTORICAL');
    let code: CatalogIntelligenceFindingCode | undefined;
    let explanation: string | undefined;
    if (active.length >= 2 && assignedEntityIds.length > 1) {
      code = 'DUPLICATE_ACTIVE_IDENTIFIER';
      explanation = 'The same normalized identifier is actively assigned to multiple canonical entities in this snapshot. It is surfaced for review; no entities were merged and no identifier was reassigned.';
    } else if (active.length >= 2 && assignedEntityIds.length === 1) {
      code = 'DUPLICATE_ACTIVE_IDENTIFIER_RECORD';
      explanation = 'Multiple active identifier records with the same normalized identity point to one canonical entity. The records are preserved for review; no duplicate was removed.';
    } else if (assignedEntityIds.length > 1 && nonHistorical.length > 0 && ordered.some(identifier => identifier.status !== 'ACTIVE')) {
      code = 'IDENTIFIER_ASSIGNMENT_REVIEW';
      explanation = 'The identifier appears across canonical entities with disputed, unknown, or historical status. The available status model has no assignment validity interval, so this is not classified as an active duplicate or as a resolved reassignment.';
    }
    if (!code || !explanation) continue;
    const first = ordered[0]!;
    const provenance = ordered.map(identifier => ({ state: identifier.provenance.state, evidence: identifier.provenance.evidence }));
    const identifierAssignments = ordered.map(identifier => ({
      identifierId: identifier.id,
      entityId: identifier.entityId,
      status: identifier.status,
      provenanceState: identifier.provenance.state,
    }));
    findings.push(CatalogIntelligenceFindingSchema.parse({
      findingId: makeFindingId(code, identityKey),
      code,
      ...common(ordered.map(identifier => identifier.id), provenance),
      entityIds: assignedEntityIds,
      relatedRecordIds: ordered.map(identifier => identifier.id),
      identifierType: first.type,
      ...(first.namespace ? { namespace: first.namespace } : {}),
      identifierAssignments,
      explanation,
    }));
  }

  if (parsed.snapshot.completeness === 'COMPLETE') {
    for (const identifier of parsed.identifiers) {
      if (entityIds.has(identifier.entityId)) continue;
      const code = 'MISSING_IDENTIFIER_ENTITY' as const;
      findings.push(CatalogIntelligenceFindingSchema.parse({
        findingId: makeFindingId(code, identifier.id),
        code,
        ...common([identifier.id], [{ state: identifier.provenance.state, evidence: identifier.provenance.evidence }]),
        entityIds: [identifier.entityId],
        relatedRecordIds: [identifier.id],
        identifierType: identifier.type,
        ...(identifier.namespace ? { namespace: identifier.namespace } : {}),
        identifierAssignments: [{
          identifierId: identifier.id,
          entityId: identifier.entityId,
          status: identifier.status,
          provenanceState: identifier.provenance.state,
        }],
        explanation: 'This complete catalog snapshot contains an identifier record whose owner does not resolve to a canonical entity. The reference is reported for review and is not converted into a canonical entity.',
      }));
    }
    for (const relationship of parsed.relationships) {
      const missingEndpoints = [
        ...(!entityIds.has(relationship.fromEntityId) ? ['FROM' as const] : []),
        ...(!entityIds.has(relationship.toEntityId) ? ['TO' as const] : []),
      ];
      if (missingEndpoints.length === 0) continue;
      const code = 'DANGLING_RELATIONSHIP_ENDPOINT' as const;
      findings.push(CatalogIntelligenceFindingSchema.parse({
        findingId: makeFindingId(code, JSON.stringify([relationship.id, missingEndpoints])),
        code,
        ...common([relationship.id], [{ state: relationship.provenance.state, evidence: relationship.provenance.evidence }]),
        entityIds: [relationship.fromEntityId, relationship.toEntityId].sort(),
        relatedRecordIds: [relationship.id],
        relationshipStatus: relationship.status,
        missingEndpoints,
        explanation: `The ${missingEndpoints.join(' and ')} endpoint of this relationship does not resolve inside a declared complete catalog snapshot. The relationship is retained and no replacement identity is guessed.`,
      }));
    }
  }

  const unassessedChecks = [...UNASSESSED_PHASE_13_CHECKS];
  if (parsed.snapshot.completeness !== 'COMPLETE') {
    unassessedChecks.unshift({
      code: 'DANGLING_REFERENCES',
      reason: `The catalog snapshot is ${parsed.snapshot.completeness.toLowerCase()}, not declared complete; a referenced entity may simply be outside this snapshot, so missing-reference findings were not emitted.`,
    });
  }

  findings.sort((left, right) => left.code.localeCompare(right.code) || left.findingId.localeCompare(right.findingId));
  return CatalogIntelligenceReportSchema.parse({
    schemaVersion: 'catalog-intelligence.v1',
    snapshot: parsed.snapshot,
    metrics: {
      entityCount: parsed.entities.length,
      identifierCount: parsed.identifiers.length,
      relationshipCount: parsed.relationships.length,
      findingCount: findings.length,
    },
    findings,
    unassessedChecks,
    evaluatedAt: parsed.evaluatedAt,
  });
}

function identifierIdentityKey(type: string, namespace: string | undefined, value: string): string {
  // Only established standard-number families ignore display separators and
  // ASCII letter case here. Proprietary, platform, and catalog values stay
  // byte-for-byte case-sensitive after schema trimming.
  const normalizedValue = SEPARATOR_INSENSITIVE_TYPES.has(type)
    ? value.replace(/[\s-]/g, '').toUpperCase()
    : value;
  return JSON.stringify([type, namespace ?? null, normalizedValue]);
}

const SEPARATOR_INSENSITIVE_TYPES = new Set([
  'ISRC', 'ISWC', 'UPC', 'EAN', 'ICPN', 'IPI', 'ISNI',
]);

function deduplicateEvidence(evidence: CatalogIntelligenceFinding['evidence']): CatalogIntelligenceFinding['evidence'] {
  const seen = new Set<string>();
  return evidence.filter(reference => {
    if (seen.has(reference.id)) return false;
    seen.add(reference.id);
    return true;
  }).sort((left, right) => left.id.localeCompare(right.id));
}

function stableHash(value: string): string {
  const hashes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    for (let lane = 0; lane < hashes.length; lane += 1) {
      let hash = Math.imul(hashes[lane]! ^ codeUnit ^ Math.imul(lane + 1, 0x9e3779b9), 0x01000193);
      hash ^= hash >>> 16;
      hashes[lane] = hash;
    }
  }
  return hashes.map(hash => {
    let mixed = hash! >>> 0;
    mixed ^= mixed >>> 16;
    mixed = Math.imul(mixed, 0x7feb352d);
    mixed ^= mixed >>> 15;
    mixed = Math.imul(mixed, 0x846ca68b);
    mixed ^= mixed >>> 16;
    return (mixed >>> 0).toString(16).padStart(8, '0');
  }).join('');
}
