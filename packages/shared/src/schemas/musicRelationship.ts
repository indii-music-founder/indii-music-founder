import { z } from 'zod';
import { ProvenanceSchema } from './musicEntity.js';

const IdSchema = z.string().trim().min(1).max(160);
const IsoDateTimeSchema = z.string().datetime();

/**
 * Canonical relationship kinds.
 *
 * These are indii domain relationships, not DDEX message fields. DDEX adapters
 * may serialize one or more of these relationships into a standards-specific
 * representation.
 */
export const MusicRelationshipTypeSchema = z.enum([
  'WROTE',
  'COMPOSED',
  'PERFORMED_ON',
  'PRODUCED',
  'PUBLISHED_BY',
  'CONTROLLED_BY',
  'EMBODIED_IN',
  'INCLUDED_ON',
  'MASTER_FILE_FOR',
  'USES_FULL_RECORDING',
  'USES_RECORDING_EXCERPT',
  'USES_ALTERNATE_MIX',
  'USES_LIVE_RECORDING',
  'USES_INSTRUMENTAL',
  'USES_STEM',
  'REFERENCES_RELEASE_ONLY',
  'NO_MUSIC_EMBEDDED',
  'DERIVED_FROM',
  'REGISTERED_WITH',
  'OTHER',
]);
export type MusicRelationshipType = z.infer<typeof MusicRelationshipTypeSchema>;

export const RelationshipStatusSchema = z.enum([
  'ACTIVE',
  'HISTORICAL',
  'DISPUTED',
  'WITHDRAWN',
  'UNKNOWN',
]);
export type RelationshipStatus = z.infer<typeof RelationshipStatusSchema>;

export const MusicRelationshipSchema = z.object({
  schemaVersion: z.literal('music-relationship.v1'),
  id: IdSchema,
  fromEntityId: IdSchema,
  toEntityId: IdSchema,
  type: MusicRelationshipTypeSchema,
  status: RelationshipStatusSchema.default('ACTIVE'),
  territoryCodes: z.array(z.string().trim().min(1).max(32)).max(300).default([]),
  effectiveFrom: z.string().date().optional(),
  effectiveThrough: z.string().date().optional(),
  attributes: z.record(z.unknown()).default({}),
  provenance: ProvenanceSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
}).strict().superRefine((relationship, ctx) => {
  if (relationship.fromEntityId === relationship.toEntityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['toEntityId'],
      message: 'A canonical relationship cannot point an entity to itself.',
    });
  }
  if (
    relationship.effectiveFrom &&
    relationship.effectiveThrough &&
    relationship.effectiveThrough < relationship.effectiveFrom
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['effectiveThrough'],
      message: 'effectiveThrough cannot be earlier than effectiveFrom.',
    });
  }
});
export type MusicRelationship = z.infer<typeof MusicRelationshipSchema>;

/**
 * Internal cluster assertion used to preserve equivalence/grouping claims
 * without destructively merging canonical entities.
 *
 * This matches the ECM architectural principle: a cluster is a sender's
 * time-bound assertion, not universal ground truth.
 */
export const ClusterAssertionTypeSchema = z.enum([
  'SAME_UNDERLYING_MUSICAL_WORK',
  'TREAT_AS_SAME_RECORDING',
]);
export type ClusterAssertionType = z.infer<typeof ClusterAssertionTypeSchema>;

export const LinkVerificationSchema = z.enum([
  'VERIFIED_BY_HUMAN',
  'CROSS_CHECKED',
  'NOT_VERIFIED',
  'USER_DEFINED',
  'UNKNOWN',
]);
export type LinkVerification = z.infer<typeof LinkVerificationSchema>;

export const ClusterMembershipBasisSchema = z.enum([
  'AUDIO_REFERENCE',
  'REFERENCE_METADATA',
  'AUDIO_AND_METADATA',
  'OTHER',
  'UNKNOWN',
]);
export type ClusterMembershipBasis = z.infer<typeof ClusterMembershipBasisSchema>;

export const ClusterMemberAssertionSchema = z.object({
  entityId: IdSchema,
  confidencePercent: z.number().min(0).max(100).optional(),
  linkVerification: LinkVerificationSchema.default('UNKNOWN'),
  membershipBasis: ClusterMembershipBasisSchema.default('UNKNOWN'),
  provenance: ProvenanceSchema,
}).strict();
export type ClusterMemberAssertion = z.infer<typeof ClusterMemberAssertionSchema>;

export const EntityClusterAssertionSchema = z.object({
  schemaVersion: z.literal('entity-cluster-assertion.v1'),
  id: IdSchema,
  assertionType: ClusterAssertionTypeSchema,
  clusterCreatorEntityId: IdSchema.optional(),
  sourceStandard: z.object({
    family: z.literal('DDEX_ECM'),
    part: z.enum(['ECM_MW', 'ECM_ISRC']),
    version: z.string().trim().min(1).max(32),
  }).strict().optional(),
  members: z.array(ClusterMemberAssertionSchema).min(2),
  assertedAt: IsoDateTimeSchema,
  provenance: ProvenanceSchema,
}).strict().superRefine((cluster, ctx) => {
  const ids = cluster.members.map(member => member.entityId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['members'],
      message: 'A cluster assertion cannot contain the same entity more than once.',
    });
  }
});
export type EntityClusterAssertion = z.infer<typeof EntityClusterAssertionSchema>;
