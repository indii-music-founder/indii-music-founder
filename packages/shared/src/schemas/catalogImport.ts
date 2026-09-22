import { z } from 'zod';
import { ProvenanceSchema } from './musicEntity.js';

const Id = z.string().trim().min(1).max(200);
const IsoDateTime = z.string().datetime();
const JsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(),
  z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema),
]));

export const CatalogImportIntentSchema = z.enum([
  'IMPORT_OLD_RELEASE',
  'TRACK_EXISTING_MUSIC',
  'MOVE_DISTRIBUTOR',
  'REGAIN_CONTROL',
  'CLEAN_CATALOG',
  'RE_RELEASE',
  'MONITOR_EXISTING_SONG',
]);
export type CatalogImportIntent = z.infer<typeof CatalogImportIntentSchema>;

export const CatalogArtifactTypeSchema = z.enum([
  'MASTER_AUDIO', 'METADATA', 'ARTWORK', 'IDENTIFIER', 'ROYALTY_STATEMENT',
  'REGISTRATION', 'SPLIT_SHEET', 'LICENSE', 'VIDEO', 'DISTRIBUTION_HISTORY',
]);
export type CatalogArtifactType = z.infer<typeof CatalogArtifactTypeSchema>;

export const CatalogImportArtifactSchema = z.object({
  artifactId: Id,
  type: CatalogArtifactTypeSchema,
  fileName: z.string().trim().min(1).max(512).optional(),
  uri: z.string().trim().min(1).max(2048).optional(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  provenance: ProvenanceSchema,
}).strict();
export type CatalogImportArtifact = z.infer<typeof CatalogImportArtifactSchema>;

export const CatalogFactAuthoritySchema = z.enum(['REFERENCE', 'AUTHORITATIVE', 'LEGAL']);
export type CatalogFactAuthority = z.infer<typeof CatalogFactAuthoritySchema>;

/**
 * A fact imported about an internal entity. `entityId` is always indii's
 * canonical identity; ISRC/ISWC/UPC and platform IDs belong in `fieldPath`
 * and `value`, and can never substitute for it.
 */
export const CatalogFactSchema = z.object({
  factId: Id,
  entityId: Id,
  fieldPath: z.string().trim().min(1).max(300),
  value: JsonValueSchema,
  authority: CatalogFactAuthoritySchema.default('REFERENCE'),
  provenance: ProvenanceSchema,
}).strict();
export type CatalogFact = z.infer<typeof CatalogFactSchema>;

export const CatalogReconciliationItemSchema = z.object({
  entityId: Id,
  fieldPath: z.string().trim().min(1).max(300),
  existingFactId: Id.optional(),
  importedFactId: Id,
  disposition: z.enum(['AGREEMENT', 'PROPOSED', 'REVIEW_REQUIRED']),
  existingValue: JsonValueSchema.optional(),
  importedValue: JsonValueSchema,
  reason: z.string().trim().min(1).max(1000),
  requiresHumanReview: z.boolean(),
}).strict();
export type CatalogReconciliationItem = z.infer<typeof CatalogReconciliationItemSchema>;

export const CatalogReconciliationSchema = z.object({
  schemaVersion: z.literal('catalog-reconciliation.v1'),
  items: z.array(CatalogReconciliationItemSchema).max(10_000),
  hasConflicts: z.boolean(),
  readyForHumanReview: z.boolean(),
  generatedAt: IsoDateTime,
}).strict();
export type CatalogReconciliation = z.infer<typeof CatalogReconciliationSchema>;

export const CatalogImportSessionSchema = z.object({
  schemaVersion: z.literal('catalog-import.v1'),
  importId: Id,
  ownerUid: Id,
  intent: CatalogImportIntentSchema,
  artifacts: z.array(CatalogImportArtifactSchema).max(1000).default([]),
  importedFacts: z.array(CatalogFactSchema).max(10_000).default([]),
  reconciliation: CatalogReconciliationSchema.optional(),
  status: z.enum(['COLLECTING', 'REVIEW_REQUIRED', 'REVIEWED', 'APPLIED']).default('COLLECTING'),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
}).strict().superRefine((session, ctx) => {
  if (session.status === 'APPLIED' && (!session.reconciliation || session.reconciliation.readyForHumanReview)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['status'], message: 'An import cannot be applied before human review is resolved.' });
  }
});
export type CatalogImportSession = z.infer<typeof CatalogImportSessionSchema>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Pure reconciliation: it proposes outcomes and never mutates either input. */
export function reconcileCatalogFacts(
  existingFacts: readonly CatalogFact[],
  importedFacts: readonly CatalogFact[],
  generatedAt: string,
): CatalogReconciliation {
  const existingByField = new Map(existingFacts.map((fact) => [`${fact.entityId}\u0000${fact.fieldPath}`, fact]));
  const items = importedFacts.map((imported): CatalogReconciliationItem => {
    const existing = existingByField.get(`${imported.entityId}\u0000${imported.fieldPath}`);
    const authoritative = imported.authority !== 'REFERENCE';
    if (!existing) {
      return {
        entityId: imported.entityId, fieldPath: imported.fieldPath,
        importedFactId: imported.factId, importedValue: imported.value,
        disposition: authoritative ? 'REVIEW_REQUIRED' : 'PROPOSED',
        reason: authoritative
          ? 'Authoritative or legal imported facts require a human checkpoint before acceptance.'
          : 'No existing fact is present; this is a non-destructive proposal.',
        requiresHumanReview: authoritative,
      };
    }
    if (stableJson(existing.value) === stableJson(imported.value)) {
      return {
        entityId: imported.entityId, fieldPath: imported.fieldPath,
        existingFactId: existing.factId, importedFactId: imported.factId,
        existingValue: existing.value, importedValue: imported.value,
        disposition: 'AGREEMENT', reason: 'Imported and existing facts agree.',
        requiresHumanReview: false,
      };
    }
    return {
      entityId: imported.entityId, fieldPath: imported.fieldPath,
      existingFactId: existing.factId, importedFactId: imported.factId,
      existingValue: existing.value, importedValue: imported.value,
      disposition: 'REVIEW_REQUIRED',
      reason: 'Imported and existing facts conflict; neither value was overwritten.',
      requiresHumanReview: true,
    };
  });
  return CatalogReconciliationSchema.parse({
    schemaVersion: 'catalog-reconciliation.v1', items,
    hasConflicts: items.some((item) => item.disposition === 'REVIEW_REQUIRED' && item.existingFactId !== undefined),
    readyForHumanReview: items.some((item) => item.requiresHumanReview),
    generatedAt,
  });
}

export function planCatalogImport(
  session: CatalogImportSession,
  existingFacts: readonly CatalogFact[],
  generatedAt: string,
): CatalogImportSession {
  const reconciliation = reconcileCatalogFacts(existingFacts, session.importedFacts, generatedAt);
  return CatalogImportSessionSchema.parse({
    ...session,
    reconciliation,
    status: reconciliation.readyForHumanReview ? 'REVIEW_REQUIRED' : session.status,
    updatedAt: generatedAt,
  });
}
