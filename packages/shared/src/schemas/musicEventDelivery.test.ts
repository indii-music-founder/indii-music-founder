import { describe, expect, it } from 'vitest';
import {
  createMusicEventDelivery,
  MusicEventDeliverySchema,
  MusicEventDeliveryTransitionError,
  transitionMusicEventDelivery,
} from './musicEventDelivery.js';
import { MusicDomainEventSchema } from './musicEvent.js';

const createdAt = '2026-09-24T17:00:00.000Z';
const event = MusicDomainEventSchema.parse({
  schemaVersion: 'music-domain-event.v1',
  eventId: 'event:delivery-status-1',
  eventType: 'delivery.status_changed',
  subject: { entityId: 'delivery:canonical-1', entityType: 'delivery' },
  relatedEntities: [{ entityId: 'release:canonical-1', entityType: 'release' }],
  occurredAt: '2026-09-24T16:59:00.000Z',
  recordedAt: createdAt,
  details: { status: 'accepted', source: 'synthetic-fixture' },
  provenance: {
    state: 'DETECTED',
    sourceType: 'EXTERNAL_SERVICE',
    sourceId: 'fixture:delivery-provider',
    evidence: [{ id: 'evidence:delivery-fixture', type: 'EXTERNAL_RECORD' }],
    observedAt: createdAt,
  },
});

function pendingDelivery(maxAttempts = 3) {
  return createMusicEventDelivery({ event, consumerId: 'connected-intelligence', createdAt, maxAttempts });
}

function claim(delivery = pendingDelivery(), leaseId = 'lease:worker-1', now = createdAt, leaseDurationMs = 60_000) {
  return transitionMusicEventDelivery(delivery, { type: 'CLAIM', leaseId, now, leaseDurationMs });
}

describe('Phase 11 music event delivery contract', () => {
  it('creates a stable per-consumer idempotency key without changing the event payload', () => {
    const first = pendingDelivery();
    const replay = pendingDelivery();
    const otherConsumer = createMusicEventDelivery({ event, consumerId: 'claims-inbox', createdAt });

    expect(first.deliveryId).toBe(replay.deliveryId);
    expect(first.idempotencyKey).toBe(first.deliveryId);
    expect(first.deliveryId).not.toBe(otherConsumer.deliveryId);
    expect(first.status).toBe('PENDING');
    expect(first.attemptCount).toBe(0);
    expect(first.event).toEqual(event);
  });

  it('claims once, accepts an acknowledgement, and treats the same acknowledgement as idempotent', () => {
    const inFlight = claim();
    expect(inFlight.status).toBe('IN_FLIGHT');
    expect(inFlight.attemptCount).toBe(1);
    expect(inFlight.lease?.leaseId).toBe('lease:worker-1');

    const acknowledged = transitionMusicEventDelivery(inFlight, {
      type: 'ACKNOWLEDGE', leaseId: 'lease:worker-1', now: '2026-09-24T17:00:10.000Z',
    });
    expect(acknowledged.status).toBe('DELIVERED');
    expect(transitionMusicEventDelivery(acknowledged, {
      type: 'ACKNOWLEDGE', leaseId: 'lease:worker-1', now: '2026-09-24T17:00:11.000Z',
    })).toEqual(acknowledged);
  });

  it('requires the active lease and rejects competing claims', () => {
    const inFlight = claim();
    expect(() => claim(inFlight, 'lease:worker-2', '2026-09-24T17:00:01.000Z')).toThrow(MusicEventDeliveryTransitionError);
    expect(() => transitionMusicEventDelivery(inFlight, {
      type: 'ACKNOWLEDGE', leaseId: 'lease:wrong-worker', now: '2026-09-24T17:00:02.000Z',
    })).toThrow(/currently active lease/);
  });

  it('rejects transitions that move the delivery ledger backwards in time', () => {
    const inFlight = claim();
    expect(() => transitionMusicEventDelivery(inFlight, {
      type: 'ACKNOWLEDGE', leaseId: 'lease:worker-1', now: '2026-09-24T16:59:59.999Z',
    })).toThrow(/cannot move the ledger timestamp backwards/);
    const newerLedger = MusicEventDeliverySchema.parse({ ...inFlight, updatedAt: '2026-09-24T17:00:02.000Z' });
    expect(() => transitionMusicEventDelivery(newerLedger, {
      type: 'FAIL', leaseId: 'lease:worker-1', now: '2026-09-24T17:00:01.000Z',
      classification: 'TRANSIENT', code: 'TIMEOUT', retryAt: '2026-09-24T17:01:00.000Z',
    })).toThrow(/cannot move the ledger timestamp backwards/);
  });

  it('waits for an explicit transient retry time and increments the next attempt', () => {
    const inFlight = claim();
    const retryWait = transitionMusicEventDelivery(inFlight, {
      type: 'FAIL', leaseId: 'lease:worker-1', now: '2026-09-24T17:00:05.000Z',
      classification: 'TRANSIENT', code: 'RATE_LIMITED', retryAt: '2026-09-24T17:01:00.000Z',
    });
    expect(retryWait.status).toBe('RETRY_WAIT');
    expect(retryWait.nextAttemptAt).toBe('2026-09-24T17:01:00.000Z');
    expect(() => claim(retryWait, 'lease:worker-2', '2026-09-24T17:00:59.999Z')).toThrow(/not yet due/);

    const retryAttempt = claim(retryWait, 'lease:worker-2', '2026-09-24T17:01:00.000Z');
    expect(retryAttempt.status).toBe('IN_FLIGHT');
    expect(retryAttempt.attemptCount).toBe(2);
    expect(retryAttempt.idempotencyKey).toBe(inFlight.idempotencyKey);
  });

  it('dead-letters permanent failures and exhausted transient attempts', () => {
    const permanent = transitionMusicEventDelivery(claim(), {
      type: 'FAIL', leaseId: 'lease:worker-1', now: '2026-09-24T17:00:05.000Z',
      classification: 'PERMANENT', code: 'INVALID_PAYLOAD',
    });
    expect(permanent.status).toBe('DEAD_LETTER');
    expect(() => claim(permanent, 'lease:worker-2', '2026-09-24T17:00:06.000Z')).toThrow();

    const singleAttempt = claim(pendingDelivery(1));
    const exhausted = transitionMusicEventDelivery(singleAttempt, {
      type: 'FAIL', leaseId: 'lease:worker-1', now: '2026-09-24T17:00:05.000Z',
      classification: 'TRANSIENT', code: 'UNAVAILABLE',
    });
    expect(exhausted.status).toBe('DEAD_LETTER');
    expect(exhausted.lastFailure?.code).toBe('UNAVAILABLE');
  });

  it('reclaims expired leases with at-least-once semantics and rejects stale worker outcomes', () => {
    const original = claim(pendingDelivery(), 'lease:worker-1', createdAt, 1_000);
    const reclaimed = claim(original, 'lease:worker-2', '2026-09-24T17:00:01.000Z');
    expect(reclaimed.attemptCount).toBe(2);
    expect(reclaimed.lastFailure?.code).toBe('LEASE_EXPIRED');
    expect(() => transitionMusicEventDelivery(reclaimed, {
      type: 'ACKNOWLEDGE', leaseId: 'lease:worker-1', now: '2026-09-24T17:00:02.000Z',
    })).toThrow(/currently active lease/);
    expect(() => claim(original, 'lease:worker-1', '2026-09-24T17:00:01.000Z')).toThrow(/fresh unique lease ID/);
  });

  it('dead-letters an expired lease at the configured attempt limit', () => {
    const lastAttempt = claim(pendingDelivery(1), 'lease:worker-1', createdAt, 1_000);
    const deadLetter = transitionMusicEventDelivery(lastAttempt, {
      type: 'CLAIM', leaseId: 'lease:worker-2', now: '2026-09-24T17:00:01.000Z', leaseDurationMs: 60_000,
    });
    expect(deadLetter.status).toBe('DEAD_LETTER');
    expect(deadLetter.lastFailure?.code).toBe('ATTEMPTS_EXHAUSTED');
  });

  it('rejects incomplete/inconsistent states, non-internal consumer IDs, and implicit retry policy', () => {
    expect(() => createMusicEventDelivery({ event, consumerId: 'https://provider.example', createdAt })).toThrow();
    expect(() => MusicEventDeliverySchema.parse({ ...pendingDelivery(), status: 'IN_FLIGHT' })).toThrow();
    expect(() => transitionMusicEventDelivery(claim(), {
      type: 'FAIL', leaseId: 'lease:worker-1', now: '2026-09-24T17:00:05.000Z',
      classification: 'TRANSIENT', code: 'TIMEOUT', retryAt: createdAt,
    })).toThrow(/future retryAt/);
  });
});
