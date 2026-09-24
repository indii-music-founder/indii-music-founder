import { z } from 'zod';
import { ProvenanceSchema } from './musicEntity.js';

const IdSchema = z.string().trim().min(1).max(160);
const IsoDateTimeSchema = z.string().datetime();

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
  'registration.confirmed',
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
]);
export type MusicEventEntityType = z.infer<typeof MusicEventEntityTypeSchema>;

export const MusicEventEntityReferenceSchema = z.object({
  entityId: IdSchema,
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
  eventId: IdSchema,
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

