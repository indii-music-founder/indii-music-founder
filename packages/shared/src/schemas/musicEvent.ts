import { z } from 'zod';
import { ProvenanceSchema } from './musicEntity.js';

const IdSchema = z.string().trim().min(1).max(160);
const IsoDateTimeSchema = z.string().datetime();
const externalIdentifierPrefixes = /^(?:isrc|iswc|upc|ean|icpn|isni|ipi|dpid|grid|catalog(?:_number)?|platform_id|proprietary|spotify|apple(?:_music)?|youtube|tiktok|instagram):/i;
const externalIdentifierValue = /^(?:[A-Z]{2}[A-Z0-9]{3}\d{7}|T-\d{3}\.\d{3}\.\d{3}-\d|\d{8,14})$/i;
const InternalReferenceIdSchema = IdSchema.refine(
  value => !externalIdentifierPrefixes.test(value) && !externalIdentifierValue.test(value),
  'External identifier values must be stored as identifiers, not canonical entity IDs.',
);

/**
 * Canonical domain events connect changes and observations to indii's
 * internal music entities. They are not analytics/conversion events and are
 * not, by themselves, proof that a legal, financial, or ownership fact is
 * authoritative. Consumers must evaluate provenance before making decisions.
 *
 * This is a portable contract only: persistence, dispatch, and projections
 * remain opt-in integrations so introducing the schema cannot enable
 * unfinished production workflows.
 */
export const MusicDomainEventTypeSchema = z.enum([
  'recording.uploaded',
  'release.planned',
  'release.live',
  'video.ready_for_tiktok',
  'video.ready_for_youtube',
  'performance.planned',
  'satellite_play.detected',
  'claim.received',
  'claim.status_changed',
  'registration.confirmed',
  'registration.status_changed',
  'delivery.status_changed',
  'usage.reported',
  'platform.connection_changed',
  'catalog.state_changed',
  'identity.conflict_detected',
  'catalog.migration.started',
  'catalog.migration.completed',
]);
export type MusicDomainEventType = z.infer<typeof MusicDomainEventTypeSchema>;

/** These are internal entity kinds; identifiers such as ISRC/UPC are not kinds. */
export const MusicEventEntityTypeSchema = z.enum([
  'person',
  'artist',
  'organization',
  'musical_work',
  'sound_recording',
  'video_resource',
  'release',
  'asset',
  'identifier',
  'rights_claim',
  'rights_grant',
  'registration',
  'agreement',
  'usage',
  'platform',
  'campaign',
  'delivery',
  'relationship',
  'provenance',
  'evidence',
]);
export type MusicEventEntityType = z.infer<typeof MusicEventEntityTypeSchema>;

/** Event kinds with a deterministic canonical subject type. */
export const MUSIC_DOMAIN_EVENT_SUBJECT_TYPES: Partial<Record<MusicDomainEventType, readonly MusicEventEntityType[]>> = {
  'recording.uploaded': ['sound_recording', 'asset'],
  'release.planned': ['release'],
  'release.live': ['release'],
  'video.ready_for_tiktok': ['video_resource'],
  'video.ready_for_youtube': ['video_resource'],
  'performance.planned': ['usage'],
  'satellite_play.detected': ['usage'],
  'claim.received': ['rights_claim'],
  'claim.status_changed': ['rights_claim'],
  'registration.confirmed': ['registration'],
  'registration.status_changed': ['registration'],
  'delivery.status_changed': ['delivery'],
  'usage.reported': ['usage'],
  'platform.connection_changed': ['platform'],
  'catalog.state_changed': ['release', 'sound_recording', 'video_resource', 'asset'],
  'identity.conflict_detected': ['person', 'artist', 'organization', 'musical_work', 'sound_recording', 'release', 'identifier', 'relationship'],
};

export const MusicEventEntityReferenceSchema = z.object({
  entityId: InternalReferenceIdSchema,
  entityType: MusicEventEntityTypeSchema,
}).strict();
export type MusicEventEntityReference = z.infer<typeof MusicEventEntityReferenceSchema>;

const EventDetailValueSchema = z.union([
  z.string().max(2048),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string().max(512), z.number().finite(), z.boolean(), z.null()])).max(100),
]);

export const MusicDomainEventSchema = z.object({
  schemaVersion: z.literal('music-domain-event.v1'),
  /** Stable internal event identity; do not derive it from an external music identifier. */
  eventId: InternalReferenceIdSchema,
  eventType: MusicDomainEventTypeSchema,
  subject: MusicEventEntityReferenceSchema,
  relatedEntities: z.array(MusicEventEntityReferenceSchema).max(100).default([]),
  /** When the source says the occurrence happened. */
  occurredAt: IsoDateTimeSchema,
  /** When indii observed/recorded it; it may be later than occurredAt. */
  recordedAt: IsoDateTimeSchema,
  /** Correlation/causation identifiers are internal workflow references. */
  correlationId: IdSchema.optional(),
  causationId: IdSchema.optional(),
  /** Small, non-authoritative event context; asserted facts still need provenance. */
  details: z.record(z.string().trim().min(1).max(100), EventDetailValueSchema).default({}),
  provenance: ProvenanceSchema,
}).strict().superRefine((event, ctx) => {
  const allowedSubjectTypes = MUSIC_DOMAIN_EVENT_SUBJECT_TYPES[event.eventType];
  if (allowedSubjectTypes && !allowedSubjectTypes.includes(event.subject.entityType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['subject', 'entityType'],
      message: `${event.eventType} events must reference one of these canonical entity types as their subject: ${allowedSubjectTypes.join(', ')}.`,
    });
  }

  if (Object.keys(event.details).length > 50) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['details'],
      message: 'Event details may contain at most 50 keys.',
    });
  }
  const subjectKey = `${event.subject.entityType}\u0000${event.subject.entityId}`;
  const seen = new Set([subjectKey]);
  for (const [index, reference] of event.relatedEntities.entries()) {
    const key = `${reference.entityType}\u0000${reference.entityId}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['relatedEntities', index],
        message: 'An event cannot reference the same entity more than once.',
      });
    }
    seen.add(key);
  }
});
export type MusicDomainEvent = z.infer<typeof MusicDomainEventSchema>;
