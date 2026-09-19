import { z } from 'zod';

/**
 * Canonical Music Identity v1
 *
 * Phase 1 foundation for indii.music.
 *
 * These contracts intentionally model indii's internal identity separately
 * from external identifiers such as ISRC, ISWC, UPC/EAN, IPI, ISNI, DPID,
 * GRID, and platform IDs. External identifiers can be duplicated, corrected,
 * disputed, or historical without changing the identity of the canonical
 * entity they describe.
 *
 * Firestore persistence is deliberately NOT prescribed here. These schemas are
 * portable domain contracts that existing and future storage shapes can map to.
 */

const IdSchema = z.string().trim().min(1).max(160);
const ShortTextSchema = z.string().trim().min(1).max(512);
const IsoDateTimeSchema = z.string().datetime();

export const ProvenanceStateSchema = z.enum([
  'DETECTED',
  'INFERRED',
  'USER_DECLARED',
  'USER_CONFIRMED',
  'DOCUMENTED',
  'EXTERNAL_VERIFIED',
  'DISPUTED',
  'UNKNOWN',
]);
export type ProvenanceState = z.infer<typeof ProvenanceStateSchema>;

export const ProvenanceSourceTypeSchema = z.enum([
  'SYSTEM',
  'USER',
  'DOCUMENT',
  'EXTERNAL_SERVICE',
  'IMPORT',
  'AGENT',
  'UNKNOWN',
]);
export type ProvenanceSourceType = z.infer<typeof ProvenanceSourceTypeSchema>;

export const EvidenceTypeSchema = z.enum([
  'DOCUMENT',
  'REGISTRATION_CONFIRMATION',
  'LICENSE',
  'AGREEMENT',
  'RECEIPT',
  'CORRESPONDENCE',
  'EXTERNAL_RECORD',
  'OTHER',
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const EvidenceReferenceSchema = z.object({
  id: IdSchema,
  type: EvidenceTypeSchema,
  description: z.string().trim().max(1000).optional(),
  uri: z.string().trim().min(1).max(2048).optional(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
}).strict();
export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;

export const ProvenanceSchema = z.object({
  state: ProvenanceStateSchema,
  sourceType: ProvenanceSourceTypeSchema,
  sourceId: IdSchema.optional(),
  assertedByEntityId: IdSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(EvidenceReferenceSchema).max(100).default([]),
  observedAt: IsoDateTimeSchema,
  confirmedAt: IsoDateTimeSchema.optional(),
  note: z.string().trim().max(2000).optional(),
}).strict();
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const MusicIdentifierTypeSchema = z.enum([
  'ISRC',
  'ISWC',
  'UPC',
  'EAN',
  'ICPN',
  'IPI',
  'ISNI',
  'DPID',
  'GRID',
  'CATALOG_NUMBER',
  'PLATFORM_ID',
  'PROPRIETARY',
]);
export type MusicIdentifierType = z.infer<typeof MusicIdentifierTypeSchema>;

export const MusicIdentifierStatusSchema = z.enum([
  'ACTIVE',
  'HISTORICAL',
  'DISPUTED',
  'UNKNOWN',
]);
export type MusicIdentifierStatus = z.infer<typeof MusicIdentifierStatusSchema>;

export const MusicIdentifierSchema = z.object({
  id: IdSchema,
  entityId: IdSchema,
  type: MusicIdentifierTypeSchema,
  value: z.string().trim().min(1).max(512),
  namespace: z.string().trim().min(1).max(256).optional(),
  status: MusicIdentifierStatusSchema.default('ACTIVE'),
  provenance: ProvenanceSchema,
}).strict();
export type MusicIdentifier = z.infer<typeof MusicIdentifierSchema>;


export const RightsClaimTypeSchema = z.enum([
  'MASTER',
  'COMPOSITION',
  'PUBLISHING',
  'PERFORMANCE',
  'MECHANICAL',
  'SYNC',
  'OTHER',
]);
export type RightsClaimType = z.infer<typeof RightsClaimTypeSchema>;

export const RightsClaimStatusSchema = z.enum([
  'ASSERTED',
  'CONFIRMED',
  'DISPUTED',
  'WITHDRAWN',
  'UNKNOWN',
]);
export type RightsClaimStatus = z.infer<typeof RightsClaimStatusSchema>;

/**
 * Canonical rights-claim base model.
 *
 * A claim is an assertion about rights in a canonical entity, not proof of
 * ownership. Provenance/evidence determine how much authority indii may assign
 * to it. Weight is deliberately modeled as a generic non-negative number:
 * RDR-N 1.5 introduced Weight on rights-claim/request composites, but indii
 * does not reinterpret that value as a percentage unless an adapter/profile
 * explicitly defines that meaning.
 */
export const RightsClaimSchema = z.object({
  schemaVersion: z.literal('rights-claim.v1'),
  id: IdSchema,
  targetEntityId: IdSchema,
  claimantEntityId: IdSchema.optional(),
  type: RightsClaimTypeSchema,
  status: RightsClaimStatusSchema.default('ASSERTED'),
  sharePercentage: z.number().min(0).max(100).optional(),
  weight: z.number().finite().nonnegative().optional(),
  territoryCodes: z.array(z.string().trim().min(1).max(32)).max(300).default([]),
  validFrom: z.string().date().optional(),
  validThrough: z.string().date().optional(),
  provenance: ProvenanceSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
}).strict().superRefine((claim, ctx) => {
  if (claim.validFrom && claim.validThrough && claim.validThrough < claim.validFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['validThrough'],
      message: 'validThrough cannot be earlier than validFrom.',
    });
  }
});
export type RightsClaim = z.infer<typeof RightsClaimSchema>;

const CanonicalEntityBaseSchema = z.object({
  schemaVersion: z.literal('canonical-music-entity.v1'),
  id: IdSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  provenance: ProvenanceSchema.optional(),
});

export const PersonEntitySchema = CanonicalEntityBaseSchema.extend({
  entityType: z.literal('person'),
  displayName: ShortTextSchema,
  legalName: ShortTextSchema.optional(),
}).strict();
export type PersonEntity = z.infer<typeof PersonEntitySchema>;

export const ArtistEntitySchema = CanonicalEntityBaseSchema.extend({
  entityType: z.literal('artist'),
  displayName: ShortTextSchema,
  roles: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
}).strict();
export type ArtistEntity = z.infer<typeof ArtistEntitySchema>;

export const OrganizationEntitySchema = CanonicalEntityBaseSchema.extend({
  entityType: z.literal('organization'),
  name: ShortTextSchema,
}).strict();
export type OrganizationEntity = z.infer<typeof OrganizationEntitySchema>;

export const MusicalWorkEntitySchema = CanonicalEntityBaseSchema.extend({
  entityType: z.literal('musical_work'),
  title: ShortTextSchema,
  alternateTitles: z.array(ShortTextSchema).max(100).default([]),
}).strict();
export type MusicalWorkEntity = z.infer<typeof MusicalWorkEntitySchema>;

export const SoundRecordingEntitySchema = CanonicalEntityBaseSchema.extend({
  entityType: z.literal('sound_recording'),
  title: ShortTextSchema,
  versionTitle: ShortTextSchema.optional(),
  durationSeconds: z.number().nonnegative().optional(),
  recordingKind: z.enum([
    'ORIGINAL',
    'REMIX',
    'REMASTER',
    'LIVE',
    'INSTRUMENTAL',
    'ACAPELLA',
    'EDIT',
    'ALTERNATE',
    'OTHER',
    'UNKNOWN',
  ]).default('UNKNOWN'),
}).strict();
export type SoundRecordingEntity = z.infer<typeof SoundRecordingEntitySchema>;

export const VideoResourceEntitySchema = CanonicalEntityBaseSchema.extend({
  entityType: z.literal('video_resource'),
  title: ShortTextSchema,
  videoKind: z.enum([
    'OFFICIAL_MUSIC_VIDEO',
    'LYRIC_VIDEO',
    'PERFORMANCE_VIDEO',
    'VISUALIZER',
    'LIVE_VIDEO',
    'PROMOTIONAL',
    'OTHER',
  ]),
  durationSeconds: z.number().nonnegative().optional(),
}).strict();
export type VideoResourceEntity = z.infer<typeof VideoResourceEntitySchema>;

export const ReleaseEntitySchema = CanonicalEntityBaseSchema.extend({
  entityType: z.literal('release'),
  title: ShortTextSchema,
  releaseType: z.enum([
    'SINGLE',
    'EP',
    'ALBUM',
    'COMPILATION',
    'MIXTAPE',
    'VIDEO_SINGLE',
    'OTHER',
  ]),
  releaseDate: z.string().date().optional(),
  originalReleaseDate: z.string().date().optional(),
}).strict();
export type ReleaseEntity = z.infer<typeof ReleaseEntitySchema>;

export const AssetEntitySchema = CanonicalEntityBaseSchema.extend({
  entityType: z.literal('asset'),
  assetKind: z.enum([
    'AUDIO_MASTER',
    'VIDEO_MASTER',
    'IMAGE',
    'DOCUMENT',
    'TEXT',
    'OTHER',
  ]),
  fileName: z.string().trim().min(1).max(1024).optional(),
  mimeType: z.string().trim().min(1).max(256).optional(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  storageRef: z.string().trim().min(1).max(2048).optional(),
}).strict();
export type AssetEntity = z.infer<typeof AssetEntitySchema>;

export const CanonicalMusicEntitySchema = z.discriminatedUnion('entityType', [
  PersonEntitySchema,
  ArtistEntitySchema,
  OrganizationEntitySchema,
  MusicalWorkEntitySchema,
  SoundRecordingEntitySchema,
  VideoResourceEntitySchema,
  ReleaseEntitySchema,
  AssetEntitySchema,
]);
export type CanonicalMusicEntity = z.infer<typeof CanonicalMusicEntitySchema>;

const AUTHORITATIVE_PROVENANCE_STATES = new Set<ProvenanceState>([
  'USER_CONFIRMED',
  'DOCUMENTED',
  'EXTERNAL_VERIFIED',
]);

/**
 * True only for provenance states strong enough to be treated as confirmed
 * business facts. DETECTED and INFERRED deliberately remain non-authoritative.
 */
export function isAuthoritativeProvenance(state: ProvenanceState): boolean {
  return AUTHORITATIVE_PROVENANCE_STATES.has(state);
}
