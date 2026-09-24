import { describe, expect, it } from 'vitest';
import {
  MusicDomainEventSchema,
  MusicDomainEventTypeSchema,
  type MusicDomainEventType,
} from './musicEvent.js';

const eventTypes: MusicDomainEventType[] = [
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
];

const now = '2026-09-24T12:00:00.000Z';
const provenance = {
  state: 'DETECTED' as const,
  sourceType: 'EXTERNAL_SERVICE' as const,
  sourceId: 'provider:event-17',
  confidence: 0.92,
  evidence: [],
  observedAt: now,
};

const event = (overrides: Record<string, unknown> = {}) => {
  const eventType = overrides.eventType ?? 'recording.uploaded';
  const subject = eventType === 'claim.received'
    ? { entityId: 'claim:internal-1', entityType: 'rights_claim' }
    : eventType === 'registration.confirmed'
      ? { entityId: 'registration:internal-1', entityType: 'registration' }
      : { entityId: 'recording:internal-1', entityType: 'sound_recording' };
  return {
    schemaVersion: 'music-domain-event.v1',
    eventId: 'event:internal-1',
    eventType,
    subject,
    occurredAt: now,
    recordedAt: now,
    provenance,
    ...overrides,
  };
};

describe('music domain event contract', () => {
  it('registers the Phase 8 roadmap event vocabulary', () => {
    expect(MusicDomainEventTypeSchema.options).toEqual(eventTypes);
  });

  it.each(eventTypes)('parses the %s event with a canonical subject', (eventType) => {
    expect(MusicDomainEventSchema.parse(event({ eventType })).eventType).toBe(eventType);
  });

  it('preserves distinct occurrence and observation timestamps and entity references', () => {
    const parsed = MusicDomainEventSchema.parse(event({
      eventType: 'registration.confirmed',
      occurredAt: '2026-09-20T10:00:00.000Z',
      recordedAt: now,
      relatedEntities: [
        { entityId: 'work:internal-4', entityType: 'musical_work' },
        { entityId: 'artist:internal-2', entityType: 'artist' },
      ],
      details: { registry: 'example', registrationReference: 'external-123' },
    }));
    expect(parsed.occurredAt).not.toBe(parsed.recordedAt);
    expect(parsed.subject.entityId).toBe('registration:internal-1');
    expect(parsed.relatedEntities[0]?.entityId).toBe('work:internal-4');
    expect(parsed.relatedEntities[1]?.entityId).toBe('artist:internal-2');
    expect(parsed.details.registrationReference).toBe('external-123');
  });

  it.each([
    ['claim.received', 'rights_claim', 'claim:internal-1', 'sound_recording', 'recording:internal-2'],
    ['registration.confirmed', 'registration', 'registration:internal-1', 'musical_work', 'work:internal-2'],
  ] as const)('%s uses its canonical domain entity as the subject', (eventType, entityType, entityId, relatedType, relatedId) => {
    const parsed = MusicDomainEventSchema.parse(event({
      eventType,
      subject: { entityId, entityType },
      relatedEntities: [{ entityId: relatedId, entityType: relatedType }],
    }));
    expect(parsed.subject).toEqual({ entityId, entityType });
    expect(parsed.relatedEntities).toEqual([{ entityId: relatedId, entityType: relatedType }]);
  });

  it.each([
    ['claim.received', 'sound_recording'],
    ['registration.confirmed', 'musical_work'],
  ] as const)('%s rejects a subject with the wrong canonical entity type', (eventType, entityType) => {
    expect(() => MusicDomainEventSchema.parse(event({
      eventType,
      subject: { entityId: 'entity:internal-1', entityType },
    }))).toThrow(/must reference a .* canonical entity as their subject/i);
  });

  it('requires provenance and rejects unknown event types or extra envelope fields', () => {
    expect(() => MusicDomainEventSchema.parse(event({ eventType: 'recording.deleted' }))).toThrow();
    const withoutProvenance: Record<string, unknown> = event();
    delete withoutProvenance.provenance;
    expect(() => MusicDomainEventSchema.parse(withoutProvenance)).toThrow();
    expect(() => MusicDomainEventSchema.parse(event({ ownerConfirmed: true }))).toThrow();
  });

  it('rejects duplicate subject/related entity references', () => {
    expect(() => MusicDomainEventSchema.parse(event({
      relatedEntities: [{ entityId: 'recording:internal-1', entityType: 'sound_recording' }],
    }))).toThrow(/same entity more than once/i);
  });

  it('bounds event detail keys and nested list sizes', () => {
    const tooManyKeys = Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`key-${index}`, index]));
    expect(() => MusicDomainEventSchema.parse(event({ details: tooManyKeys }))).toThrow(/at most 50 keys/i);
    expect(() => MusicDomainEventSchema.parse(event({ details: { values: Array(101).fill('x') } }))).toThrow();
  });

  it('does not treat detected event provenance as verified truth', () => {
    const parsed = MusicDomainEventSchema.parse(event({ eventType: 'claim.received' }));
    expect(parsed.provenance.state).toBe('DETECTED');
    expect(parsed.provenance.state).not.toBe('EXTERNAL_VERIFIED');
  });
});
