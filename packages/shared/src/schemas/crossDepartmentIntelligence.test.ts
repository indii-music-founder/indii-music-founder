import { describe, expect, it } from 'vitest';
import {
  CROSS_DEPARTMENT_EVENT_ROUTES,
  createCrossDepartmentReviewPlan,
} from './crossDepartmentIntelligence.js';
import { MusicDomainEventSchema, MusicDomainEventTypeSchema, type MusicDomainEventType, type MusicEventEntityType } from './musicEvent.js';

const now = '2026-09-25T12:00:00.000Z';
const subjectTypes: Record<MusicDomainEventType, string> = {
  'recording.uploaded': 'sound_recording',
  'release.planned': 'release',
  'release.live': 'release',
  'video.ready_for_tiktok': 'video_resource',
  'video.ready_for_youtube': 'video_resource',
  'performance.planned': 'usage',
  'satellite_play.detected': 'usage',
  'claim.received': 'rights_claim',
  'claim.status_changed': 'rights_claim',
  'registration.confirmed': 'registration',
  'registration.status_changed': 'registration',
  'delivery.status_changed': 'delivery',
  'usage.reported': 'usage',
  'platform.connection_changed': 'platform',
  'catalog.state_changed': 'release',
  'identity.conflict_detected': 'artist',
  'catalog.migration.started': 'release',
  'catalog.migration.completed': 'release',
};

function eventForType(eventType: MusicDomainEventType) {
  return MusicDomainEventSchema.parse({
    schemaVersion: 'music-domain-event.v1' as const,
    eventId: `event:phase15:${eventType}`,
    eventType,
    subject: { entityId: `subject:${eventType}`, entityType: subjectTypes[eventType] as MusicEventEntityType },
    relatedEntities: [{ entityId: 'related:secret-context', entityType: 'asset' as const }],
    occurredAt: now,
    recordedAt: now,
    details: { privatePayload: 'must-not-be-copied-to-each-department' },
    provenance: {
      state: 'DETECTED' as const,
      sourceType: 'USER' as const,
      sourceId: 'fixture:phase15',
      evidence: [{ id: 'evidence:secret', type: 'OTHER' as const, description: 'must not be copied' }],
      observedAt: now,
    },
  });
}

describe('Phase 15 cross-department review routing', () => {
  it('routes every current canonical event type through an explicit bounded static map', () => {
    const eventTypes = MusicDomainEventTypeSchema.options;
    expect(Object.keys(CROSS_DEPARTMENT_EVENT_ROUTES).sort()).toEqual([...eventTypes].sort());
    for (const eventType of eventTypes) {
      const plan = createCrossDepartmentReviewPlan(eventForType(eventType));
      const departments = plan.requests.map(request => request.department);
      expect(departments.length).toBeGreaterThan(0);
      expect(departments.length).toBeLessThanOrEqual(8);
      expect(new Set(departments).size).toBe(departments.length);
      expect(plan.requests.every(request => request.requiresHumanReview && !request.executionAuthorized)).toBe(true);
    }
  });

  it('is deterministic and carries only minimal review pointers, not event payload or evidence', () => {
    const event = eventForType('claim.received');
    const first = createCrossDepartmentReviewPlan(event);
    const second = createCrossDepartmentReviewPlan(event);
    expect(first).toEqual(second);
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain('privatePayload');
    expect(serialized).not.toContain('related:secret-context');
    expect(serialized).not.toContain('evidence:secret');
    expect(first.sourceEventId).toBe(event.eventId);
    expect(first.eventType).toBe(event.eventType);
    expect(first.subject).toEqual(event.subject);
    expect(first.sourceProvenanceState).toBe('DETECTED');
    expect(first.requests.map(request => request.requestId)).toEqual([
      ...new Set(first.requests.map(request => request.requestId)),
    ]);
  });

  it('is consumed by Connected Intelligence even when its own readiness rules are not evaluated', async () => {
    const { evaluateConnectedIntelligence } = await import('./connectedIntelligence.js');
    const input = {
      event: eventForType('recording.uploaded'),
      freshnessPolicy: { rightsReportMaxAgeMs: 60_000, registrationMaxAgeMs: 60_000, platformReadinessMaxAgeMs: 60_000 },
      evaluatedAt: now,
    };
    const result = evaluateConnectedIntelligence(input);
    expect(result.status).toBe('NOT_EVALUATED');
    expect(result.departmentReviewPlan).toEqual(createCrossDepartmentReviewPlan(input.event));
  });
});
