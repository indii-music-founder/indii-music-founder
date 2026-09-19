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

export const EcmResourceTypeSchema = z.enum(['SoundRecording', 'MusicVideo']);
export type EcmResourceType = z.infer<typeof EcmResourceTypeSchema>;

export const EcmResourceReferenceSchema = z.object({
  resourceType: EcmResourceTypeSchema,
  isrc: OptionalId,
  proprietaryId: EcmProprietaryIdSchema.optional(),
  title: NonBlank,
  displayArtistName: NonBlank,
  durationIso8601: OptionalId,
}).strict().superRefine((resource, ctx) => {
  if (!resource.isrc && !resource.proprietaryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['isrc'],
      message: 'An ECM resource reference needs an ISRC or proprietary identifier.',
    });
  }
});
export type EcmResourceReference = z.infer<typeof EcmResourceReferenceSchema>;

export const EcmClusterMemberMetadataSchema = z.object({
  membershipType: z.enum(['AudioFile', 'Metadata', 'AudioFileAndMetadata', 'UserDefined']).optional(),
  confidencePercent: z.number().min(0).max(100).optional(),
  linkVerification: z.enum(['VerifiedByHuman', 'CrossChecked', 'NotVerified', 'UserDefined']).optional(),
}).strict();
export type EcmClusterMemberMetadata = z.infer<typeof EcmClusterMemberMetadataSchema>;

export const EcmMusicalWorkReferenceSchema = z.object({
  iswc: OptionalId,
  proprietaryId: EcmProprietaryIdSchema.optional(),
  title: NonBlank,
  writers: z.array(NonBlank).max(200).default([]),
}).strict().superRefine((work, ctx) => {
  if (!work.iswc && !work.proprietaryId && work.writers.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['writers'],
      message: 'A musical work without ISWC/proprietary ID needs at least one writer for disambiguation.',
    });
  }
});
export type EcmMusicalWorkReference = z.infer<typeof EcmMusicalWorkReferenceSchema>;

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
  clusterRoot: EcmMusicalWorkReferenceSchema,
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
  musicalWork: EcmMusicalWorkReferenceSchema.optional(),
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
  clusterRoot: EcmResourceReferenceSchema.extend({
    durationIso8601: NonBlank,
  }).strict(),
  members: z.array(
    z.object({
      resource: EcmResourceReferenceSchema.extend({
        durationIso8601: NonBlank,
      }).strict(),
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
  resource: EcmResourceReferenceSchema,
}).strict();
export type DuplicateIsrcClusterRequestIntent = z.infer<typeof DuplicateIsrcClusterRequestIntentSchema>;
