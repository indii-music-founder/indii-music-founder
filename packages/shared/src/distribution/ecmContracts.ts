import { z } from 'zod';

const NonBlank = z.string().trim().min(1);
const OptionalId = z.string().trim().min(1).optional();

export const EcmProprietaryIdSchema = z.object({
  namespace: OptionalId,
  value: NonBlank,
}).strict();
export type EcmProprietaryId = z.infer<typeof EcmProprietaryIdSchema>;

export const EcmPartyRefSchema = z.object({
  ddexPartyId: NonBlank,
  name: NonBlank.optional(),
}).strict();
export type EcmPartyRef = z.infer<typeof EcmPartyRefSchema>;

export const EcmMessageContextSchema = z.object({
  messageId: EcmProprietaryIdSchema,
  sender: EcmPartyRefSchema,
  recipient: EcmPartyRefSchema,
  createdAt: z.string().datetime(),
  standardVersion: z.literal('1.0'),
  avsVersion: z.literal('012'),
}).strict();
export type EcmMessageContext = z.infer<typeof EcmMessageContextSchema>;

export const EcmResourceTypeSchema = z.enum(['SoundRecording', 'Video']);
export type EcmResourceType = z.infer<typeof EcmResourceTypeSchema>;

const EcmResourceDescriptionSchema = z.object({
  resourceType: EcmResourceTypeSchema,
  isrc: OptionalId,
  proprietaryId: EcmProprietaryIdSchema.optional(),
  title: NonBlank,
  displayArtistName: NonBlank,
  durationIso8601: OptionalId,
}).strict();

function requireResourceIdentity(
  resource: { isrc?: string; proprietaryId?: EcmProprietaryId },
  ctx: z.RefinementCtx,
): void {
  if (!resource.isrc && !resource.proprietaryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['isrc'],
      message: 'An ECM resource reference needs an ISRC or proprietary identifier.',
    });
  }
}

export const EcmResourceReferenceSchema = EcmResourceDescriptionSchema.superRefine(requireResourceIdentity);
export type EcmResourceReference = z.infer<typeof EcmResourceReferenceSchema>;

const EcmTimedResourceReferenceSchema = EcmResourceDescriptionSchema.extend({
  durationIso8601: NonBlank,
}).strict().superRefine(requireResourceIdentity);

/**
 * Part 3 requests permit descriptive lookup using ResourceType, Title, and
 * DisplayArtistName; identifier/duration may be supplied when available.
 */
export const EcmResourceLookupSchema = EcmResourceDescriptionSchema;
export type EcmResourceLookup = z.infer<typeof EcmResourceLookupSchema>;

export const EcmClusterMemberMetadataSchema = z.object({
  /**
   * DDEX ClusterMembershipType AVS value.
   * Kept opaque until AVS 012 is imported from the authoritative DDEX
   * data dictionary/XSD; do not invent or normalize combined values here.
   */
  membershipType: NonBlank.optional(),
  confidencePercent: z.number().min(0).max(100).optional(),
  linkVerification: z.enum(['VerifiedByHuman', 'CrossChecked', 'NotVerified', 'UserDefined']).optional(),
}).strict();
export type EcmClusterMemberMetadata = z.infer<typeof EcmClusterMemberMetadataSchema>;

export const EcmMusicalWorkLookupSchema = z.object({
  iswc: OptionalId,
  proprietaryId: EcmProprietaryIdSchema.optional(),
  title: NonBlank.optional(),
  writers: z.array(NonBlank).max(200).default([]),
}).strict().superRefine((work, ctx) => {
  const hasIdentifier=Boolean(work.iswc || work.proprietaryId);
  const hasTitleAndWriter=Boolean(work.title && work.writers.length>0);
  if (!hasIdentifier && !hasTitleAndWriter) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A musical-work lookup needs an identifier or title plus at least one writer.',
    });
  }
});
export type EcmMusicalWorkLookup = z.infer<typeof EcmMusicalWorkLookupSchema>;

export const EcmMusicalWorkClusterRootSchema = z.object({
  iswc: OptionalId,
  proprietaryId: EcmProprietaryIdSchema.optional(),
  title: NonBlank,
  writers: z.array(NonBlank).max(200).default([]),
}).strict().superRefine((work, ctx) => {
  if (!work.iswc && !work.proprietaryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['iswc'],
      message: 'A MusicalWorkClusterNotification root needs a musical-work identifier.',
    });
  }
});
export type EcmMusicalWorkClusterRoot = z.infer<typeof EcmMusicalWorkClusterRootSchema>;

const NotificationCorrelationSchema = z.object({
  requestedClusterIds: z.array(EcmProprietaryIdSchema).max(100).default([]),
  clusterCreatorClusterId: EcmProprietaryIdSchema.optional(),
}).strict();

/**
 * Adapter-facing contract for the data indii must possess before constructing
 * an ECM Part 2 MusicalWorkClusterNotification.
 *
 * This is NOT the official DDEX JSON wire schema. A future serializer must map
 * these validated values into the licensed/published DDEX message definition.
 */
export const MusicalWorkClusterNotificationIntentSchema = z.object({
  messageType: z.literal('MusicalWorkClusterNotification'),
  context: EcmMessageContextSchema,
  clusterId: EcmProprietaryIdSchema,
  clusterRoot: EcmMusicalWorkClusterRootSchema,
  members: z.array(
    z.object({
      resource: EcmResourceReferenceSchema,
      disambiguation: EcmClusterMemberMetadataSchema.default({}),
    }).strict(),
  ).min(1),
  correlation: NotificationCorrelationSchema.default({ requestedClusterIds: [] }),
}).strict();
export type MusicalWorkClusterNotificationIntent = z.infer<typeof MusicalWorkClusterNotificationIntentSchema>;

/**
 * Part 2 request can identify a work (ISWC or title + writer) or identify a
 * resource whose returned cluster should contain the resource, work root, and
 * other members for that work.
 */
export const MusicalWorkClusterRequestIntentSchema = z.object({
  messageType: z.literal('MusicalWorkClusterRequest'),
  context: EcmMessageContextSchema,
  requestClusterId: EcmProprietaryIdSchema,
  musicalWork: EcmMusicalWorkLookupSchema.optional(),
  resource: EcmResourceReferenceSchema.optional(),
}).strict().superRefine((request, ctx) => {
  if (!request.musicalWork && !request.resource) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A MusicalWorkClusterRequest needs a musical work or resource reference.',
    });
  }
});
export type MusicalWorkClusterRequestIntent = z.infer<typeof MusicalWorkClusterRequestIntentSchema>;

/**
 * Adapter-facing contract for ECM Part 3 duplicate-ISRC cluster notification.
 * Root and members remain separate canonical resources; this contract does not
 * authorize identifier replacement, revocation, or canonical entity merging.
 */
export const DuplicateIsrcClusterNotificationIntentSchema = z.object({
  messageType: z.literal('DuplicateIsrcClusterNotification'),
  context: EcmMessageContextSchema,
  clusterId: EcmProprietaryIdSchema,
  clusterRoot: EcmTimedResourceReferenceSchema,
  members: z.array(
    z.object({
      resource: EcmTimedResourceReferenceSchema,
      disambiguation: EcmClusterMemberMetadataSchema.default({}),
      recordingMode: NonBlank.optional(),
      fingerprint: z.object({
        algorithm: NonBlank,
        value: NonBlank,
      }).strict().optional(),
    }).strict(),
  ).min(1),
  correlation: NotificationCorrelationSchema.default({ requestedClusterIds: [] }),
}).strict();
export type DuplicateIsrcClusterNotificationIntent = z.infer<typeof DuplicateIsrcClusterNotificationIntentSchema>;

export const DuplicateIsrcClusterRequestIntentSchema = z.object({
  messageType: z.literal('DuplicateIsrcClusterRequest'),
  context: EcmMessageContextSchema,
  requestClusterId: EcmProprietaryIdSchema,
  resource: EcmResourceLookupSchema,
}).strict();
export type DuplicateIsrcClusterRequestIntent = z.infer<typeof DuplicateIsrcClusterRequestIntentSchema>;
