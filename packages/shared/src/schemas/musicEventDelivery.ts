import { z } from 'zod';
import { MusicDomainEventSchema } from './musicEvent.js';

const IsoDateTimeSchema = z.string().datetime();
const LeaseIdSchema = z.string().trim().min(1).max(128);
const ConsumerIdSchema = z.string().trim().min(1).max(64).regex(
  /^[a-z][a-z0-9._-]*$/i,
  'Consumer IDs must be stable internal names, not URLs or credentials.',
);
const DeliveryIdSchema = z.string().regex(/^music-delivery:[a-f0-9]{32}$/);

export const MusicEventDeliveryStatusSchema = z.enum([
  'PENDING',
  'IN_FLIGHT',
  'RETRY_WAIT',
  'DELIVERED',
  'DEAD_LETTER',
]);
export type MusicEventDeliveryStatus = z.infer<typeof MusicEventDeliveryStatusSchema>;

export const MusicEventDeliveryFailureSchema = z.object({
  leaseId: LeaseIdSchema,
  classification: z.enum(['TRANSIENT', 'PERMANENT']),
  code: z.enum([
    'TIMEOUT',
    'RATE_LIMITED',
    'UNAVAILABLE',
    'AUTHENTICATION',
    'INVALID_PAYLOAD',
    'UNSUPPORTED_EVENT',
    'LEASE_EXPIRED',
    'ATTEMPTS_EXHAUSTED',
    'OTHER',
  ]),
  occurredAt: IsoDateTimeSchema,
}).strict();
export type MusicEventDeliveryFailure = z.infer<typeof MusicEventDeliveryFailureSchema>;

export const MusicEventDeliveryLeaseSchema = z.object({
  leaseId: LeaseIdSchema,
  acquiredAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
}).strict().superRefine((lease, ctx) => {
  if (Date.parse(lease.expiresAt) <= Date.parse(lease.acquiredAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Lease expiry must be later than acquisition.' });
  }
});
export type MusicEventDeliveryLease = z.infer<typeof MusicEventDeliveryLeaseSchema>;

/**
 * Stable event payload plus one consumer's delivery ledger entry. This schema
 * is a portable contract only; persistence, scheduling, and dispatch are owned
 * by a later server-side integration.
 */
export const MusicEventDeliverySchema = z.object({
  schemaVersion: z.literal('music-event-delivery.v1'),
  deliveryId: DeliveryIdSchema,
  /** Consumer-specific idempotency key; remains unchanged across retries. */
  idempotencyKey: DeliveryIdSchema,
  consumerId: ConsumerIdSchema,
  event: MusicDomainEventSchema,
  status: MusicEventDeliveryStatusSchema,
  attemptCount: z.number().int().min(0).max(1000),
  maxAttempts: z.number().int().min(1).max(100),
  /** Server-generated nonce history prevents a stale lease ID being reused on a later attempt. */
  leaseHistory: z.array(LeaseIdSchema).max(100),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  lease: MusicEventDeliveryLeaseSchema.optional(),
  nextAttemptAt: IsoDateTimeSchema.optional(),
  lastFailure: MusicEventDeliveryFailureSchema.optional(),
  completedLeaseId: LeaseIdSchema.optional(),
  deliveredAt: IsoDateTimeSchema.optional(),
  deadLetteredAt: IsoDateTimeSchema.optional(),
}).strict().superRefine((delivery, ctx) => {
  if (delivery.idempotencyKey !== delivery.deliveryId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['idempotencyKey'], message: 'The idempotency key must remain the stable delivery ID.' });
  }
  if (Date.parse(delivery.updatedAt) < Date.parse(delivery.createdAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['updatedAt'], message: 'Delivery update time cannot precede creation.' });
  }
  if (delivery.attemptCount > delivery.maxAttempts) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['attemptCount'], message: 'Delivery attempts cannot exceed the configured maximum.' });
  }
  if (delivery.attemptCount !== delivery.leaseHistory.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['leaseHistory'], message: 'Every delivery attempt must have exactly one lease ID.' });
  }
  if (new Set(delivery.leaseHistory).size !== delivery.leaseHistory.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['leaseHistory'], message: 'Lease IDs must be unique across delivery attempts.' });
  }
  if (delivery.lastFailure && Date.parse(delivery.lastFailure.occurredAt) > Date.parse(delivery.updatedAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lastFailure', 'occurredAt'], message: 'A failure cannot occur after the delivery record update.' });
  }

  const addStateIssue = (path: string, message: string) => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  };
  if (delivery.status === 'PENDING') {
    if (delivery.attemptCount !== 0 || delivery.leaseHistory.length !== 0 || delivery.lease || delivery.nextAttemptAt || delivery.lastFailure || delivery.completedLeaseId || delivery.deliveredAt || delivery.deadLetteredAt) {
      addStateIssue('status', 'Pending deliveries have no attempts, lease, retry, or terminal outcome.');
    }
  } else if (delivery.status === 'IN_FLIGHT') {
    if (delivery.attemptCount < 1 || !delivery.lease || delivery.leaseHistory.at(-1) !== delivery.lease.leaseId || delivery.nextAttemptAt || delivery.completedLeaseId || delivery.deliveredAt || delivery.deadLetteredAt) {
      addStateIssue('status', 'In-flight deliveries require an attempt and lease, and cannot have retry or terminal timestamps.');
    }
    if (delivery.lease && Date.parse(delivery.lease.acquiredAt) < Date.parse(delivery.createdAt)) {
      addStateIssue('lease', 'A delivery lease cannot be acquired before the delivery is created.');
    }
    if (delivery.lease && Date.parse(delivery.lease.acquiredAt) > Date.parse(delivery.updatedAt)) {
      addStateIssue('lease', 'A lease cannot be acquired after the delivery record update.');
    }
  } else if (delivery.status === 'RETRY_WAIT') {
    if (delivery.attemptCount < 1 || delivery.lease || !delivery.nextAttemptAt || delivery.lastFailure?.classification !== 'TRANSIENT' || delivery.lastFailure.leaseId !== delivery.leaseHistory.at(-1) || delivery.completedLeaseId || delivery.deliveredAt || delivery.deadLetteredAt) {
      addStateIssue('status', 'Retry-wait deliveries require a transient failure and next-attempt time, but no lease or terminal outcome.');
    }
    if (delivery.attemptCount >= delivery.maxAttempts) {
      addStateIssue('attemptCount', 'Retry-wait deliveries must have at least one configured attempt remaining.');
    }
    if (delivery.nextAttemptAt && delivery.lastFailure && Date.parse(delivery.nextAttemptAt) <= Date.parse(delivery.lastFailure.occurredAt)) {
      addStateIssue('nextAttemptAt', 'A retry must be scheduled after its transient failure.');
    }
  } else if (delivery.status === 'DELIVERED') {
    if (delivery.attemptCount < 1 || delivery.lease || delivery.nextAttemptAt || !delivery.completedLeaseId || delivery.completedLeaseId !== delivery.leaseHistory.at(-1) || !delivery.deliveredAt || delivery.deadLetteredAt) {
      addStateIssue('status', 'Delivered records require a completed lease and delivery time, with no active retry or dead-letter state.');
    }
    if (delivery.deliveredAt && Date.parse(delivery.deliveredAt) > Date.parse(delivery.updatedAt)) {
      addStateIssue('deliveredAt', 'Delivery completion cannot occur after the record update.');
    }
  } else if (delivery.status === 'DEAD_LETTER') {
    if (delivery.attemptCount < 1 || delivery.lease || delivery.nextAttemptAt || !delivery.lastFailure || delivery.lastFailure.leaseId !== delivery.leaseHistory.at(-1) || !delivery.deadLetteredAt || delivery.completedLeaseId || delivery.deliveredAt) {
      addStateIssue('status', 'Dead-letter records require a failure and terminal time, with no active lease or retry.');
    }
    if (delivery.deadLetteredAt && delivery.lastFailure && Date.parse(delivery.deadLetteredAt) < Date.parse(delivery.lastFailure.occurredAt)) {
      addStateIssue('deadLetteredAt', 'Dead-lettering cannot precede the terminal failure.');
    }
  }
});
export type MusicEventDelivery = z.infer<typeof MusicEventDeliverySchema>;

export const CreateMusicEventDeliveryInputSchema = z.object({
  event: MusicDomainEventSchema,
  consumerId: ConsumerIdSchema,
  createdAt: IsoDateTimeSchema,
  maxAttempts: z.number().int().min(1).max(100).default(8),
}).strict();
export type CreateMusicEventDeliveryInput = z.input<typeof CreateMusicEventDeliveryInputSchema>;

/**
 * Creates a deterministic consumer-specific delivery key from the internal
 * event ID and consumer name. Repeated enqueue requests therefore converge
 * on one ledger identity; this does not persist or dispatch the event.
 */
export function createMusicEventDelivery(input: CreateMusicEventDeliveryInput): MusicEventDelivery {
  const parsed = CreateMusicEventDeliveryInputSchema.parse(input);
  const deliveryId = `music-delivery:${stableIdHash(JSON.stringify([parsed.event.eventId, parsed.consumerId]))}`;
  return MusicEventDeliverySchema.parse({
    schemaVersion: 'music-event-delivery.v1',
    deliveryId,
    idempotencyKey: deliveryId,
    consumerId: parsed.consumerId,
    event: parsed.event,
    status: 'PENDING',
    attemptCount: 0,
    maxAttempts: parsed.maxAttempts,
    leaseHistory: [],
    createdAt: parsed.createdAt,
    updatedAt: parsed.createdAt,
  });
}

export const MusicEventDeliveryClaimCommandSchema = z.object({
  type: z.literal('CLAIM'),
  leaseId: LeaseIdSchema,
  now: IsoDateTimeSchema,
  leaseDurationMs: z.number().int().min(1_000).max(24 * 60 * 60 * 1000),
}).strict();

export const MusicEventDeliveryAcknowledgeCommandSchema = z.object({
  type: z.literal('ACKNOWLEDGE'),
  leaseId: LeaseIdSchema,
  now: IsoDateTimeSchema,
}).strict();

export const MusicEventDeliveryFailCommandSchema = z.object({
  type: z.literal('FAIL'),
  leaseId: LeaseIdSchema,
  now: IsoDateTimeSchema,
  classification: z.enum(['TRANSIENT', 'PERMANENT']),
  code: MusicEventDeliveryFailureSchema.shape.code,
  retryAt: IsoDateTimeSchema.optional(),
}).strict();

export const MusicEventDeliveryCommandSchema = z.discriminatedUnion('type', [
  MusicEventDeliveryClaimCommandSchema,
  MusicEventDeliveryAcknowledgeCommandSchema,
  MusicEventDeliveryFailCommandSchema,
]);
export type MusicEventDeliveryCommand = z.infer<typeof MusicEventDeliveryCommandSchema>;

export class MusicEventDeliveryTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MusicEventDeliveryTransitionError';
  }
}

/**
 * Applies one deterministic delivery transition. Delivery is at-least-once:
 * consumers must deduplicate with `idempotencyKey` before performing effects.
 * Expired leases can be reclaimed, but stale acknowledgements are rejected.
 */
export function transitionMusicEventDelivery(
  input: MusicEventDelivery,
  commandInput: MusicEventDeliveryCommand,
): MusicEventDelivery {
  const delivery = MusicEventDeliverySchema.parse(input);
  const command = MusicEventDeliveryCommandSchema.parse(commandInput);
  const nowMs = Date.parse(command.now);

  if (command.type === 'CLAIM') {
    const leaseExpiryMs = nowMs + command.leaseDurationMs;
    if (!Number.isFinite(leaseExpiryMs)) throw new MusicEventDeliveryTransitionError('Lease expiry is outside the supported date range.');
    if (delivery.status === 'IN_FLIGHT' && delivery.lease?.leaseId === command.leaseId && nowMs < Date.parse(delivery.lease.expiresAt)) {
      return delivery;
    }
    if (delivery.leaseHistory.includes(command.leaseId)) {
      throw new MusicEventDeliveryTransitionError('Each delivery attempt requires a fresh unique lease ID.');
    }
    assertMonotonicTransitionTime(delivery, nowMs);

    const expiredLease = delivery.status === 'IN_FLIGHT' && delivery.lease && nowMs >= Date.parse(delivery.lease.expiresAt)
      ? delivery.lease
      : undefined;
    if (delivery.status === 'PENDING') {
      if (nowMs < Date.parse(delivery.createdAt)) throw new MusicEventDeliveryTransitionError('A pending delivery cannot be claimed before creation time.');
    } else if (delivery.status === 'RETRY_WAIT') {
      if (nowMs < Date.parse(delivery.nextAttemptAt!)) throw new MusicEventDeliveryTransitionError('The retry schedule is not yet due.');
    } else if (!expiredLease) {
      throw new MusicEventDeliveryTransitionError('Only pending, due retry, or expired-lease deliveries can be claimed.');
    }

    if (expiredLease && delivery.attemptCount >= delivery.maxAttempts) {
      const failure: MusicEventDeliveryFailure = {
        leaseId: expiredLease.leaseId,
        classification: 'TRANSIENT',
        code: 'ATTEMPTS_EXHAUSTED',
        occurredAt: command.now,
      };
      return MusicEventDeliverySchema.parse({
        ...delivery,
        status: 'DEAD_LETTER',
        lease: undefined,
        nextAttemptAt: undefined,
        lastFailure: failure,
        completedLeaseId: undefined,
        deliveredAt: undefined,
        deadLetteredAt: command.now,
        updatedAt: command.now,
      });
    }

    const lease: MusicEventDeliveryLease = {
      leaseId: command.leaseId,
      acquiredAt: command.now,
      expiresAt: new Date(leaseExpiryMs).toISOString(),
    };
    return MusicEventDeliverySchema.parse({
      ...delivery,
      status: 'IN_FLIGHT',
      attemptCount: delivery.attemptCount + 1,
      leaseHistory: [...delivery.leaseHistory, command.leaseId],
      lease,
      nextAttemptAt: undefined,
      lastFailure: expiredLease ? {
        leaseId: expiredLease.leaseId,
        classification: 'TRANSIENT',
        code: 'LEASE_EXPIRED',
        occurredAt: command.now,
      } : delivery.lastFailure,
      completedLeaseId: undefined,
      deliveredAt: undefined,
      deadLetteredAt: undefined,
      updatedAt: command.now,
    });
  }

  if (command.type === 'ACKNOWLEDGE') {
    if (delivery.status === 'DELIVERED' && delivery.completedLeaseId === command.leaseId) return delivery;
    assertCurrentLease(delivery, command.leaseId, nowMs);
    assertMonotonicTransitionTime(delivery, nowMs);
    return MusicEventDeliverySchema.parse({
      ...delivery,
      status: 'DELIVERED',
      lease: undefined,
      nextAttemptAt: undefined,
      completedLeaseId: command.leaseId,
      deliveredAt: command.now,
      deadLetteredAt: undefined,
      updatedAt: command.now,
    });
  }

  const retryAtMs = command.retryAt ? Date.parse(command.retryAt) : undefined;
  if (delivery.lastFailure?.leaseId === command.leaseId
    && delivery.lastFailure.classification === command.classification
    && delivery.lastFailure.code === command.code
    && ((delivery.status === 'RETRY_WAIT' && command.retryAt === delivery.nextAttemptAt)
      || (delivery.status === 'DEAD_LETTER' && command.retryAt === undefined))) {
    return delivery;
  }
  assertCurrentLease(delivery, command.leaseId, nowMs);
  assertMonotonicTransitionTime(delivery, nowMs);

  const failure: MusicEventDeliveryFailure = {
    leaseId: command.leaseId,
    classification: command.classification,
    code: command.code,
    occurredAt: command.now,
  };
  const shouldRetry = command.classification === 'TRANSIENT' && delivery.attemptCount < delivery.maxAttempts;
  if (shouldRetry) {
    if (retryAtMs === undefined || retryAtMs <= nowMs) {
      throw new MusicEventDeliveryTransitionError('A transient failure below max attempts requires a future retryAt.');
    }
    return MusicEventDeliverySchema.parse({
      ...delivery,
      status: 'RETRY_WAIT',
      lease: undefined,
      nextAttemptAt: command.retryAt,
      lastFailure: failure,
      completedLeaseId: undefined,
      deliveredAt: undefined,
      deadLetteredAt: undefined,
      updatedAt: command.now,
    });
  }
  if (command.retryAt !== undefined) {
    throw new MusicEventDeliveryTransitionError('Permanent or exhausted failures cannot schedule a retry.');
  }
  return MusicEventDeliverySchema.parse({
    ...delivery,
    status: 'DEAD_LETTER',
    lease: undefined,
    nextAttemptAt: undefined,
    lastFailure: failure,
    completedLeaseId: undefined,
    deliveredAt: undefined,
    deadLetteredAt: command.now,
    updatedAt: command.now,
  });
}

function assertCurrentLease(delivery: MusicEventDelivery, leaseId: string, nowMs: number): asserts delivery is MusicEventDelivery & { status: 'IN_FLIGHT'; lease: MusicEventDeliveryLease } {
  if (delivery.status !== 'IN_FLIGHT' || !delivery.lease || delivery.lease.leaseId !== leaseId) {
    throw new MusicEventDeliveryTransitionError('The transition requires the currently active lease.');
  }
  if (nowMs >= Date.parse(delivery.lease.expiresAt)) {
    throw new MusicEventDeliveryTransitionError('The lease has expired; a stale worker cannot acknowledge or fail this delivery.');
  }
}

function assertMonotonicTransitionTime(delivery: MusicEventDelivery, nowMs: number): void {
  if (nowMs < Date.parse(delivery.updatedAt)) {
    throw new MusicEventDeliveryTransitionError('A delivery transition cannot move the ledger timestamp backwards.');
  }
  if (delivery.status === 'IN_FLIGHT' && delivery.lease && nowMs < Date.parse(delivery.lease.acquiredAt)) {
    throw new MusicEventDeliveryTransitionError('A delivery outcome cannot precede acquisition of its active lease.');
  }
}

function stableIdHash(value: string): string {
  const hashes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    for (let lane = 0; lane < hashes.length; lane += 1) {
      let hash = Math.imul(hashes[lane]! ^ codeUnit ^ Math.imul(lane + 1, 0x9e3779b9), 0x01000193);
      hash ^= hash >>> 16;
      hashes[lane] = hash;
    }
  }
  return hashes.map(hash => {
    let mixed = hash! >>> 0;
    mixed ^= mixed >>> 16;
    mixed = Math.imul(mixed, 0x7feb352d);
    mixed ^= mixed >>> 15;
    mixed = Math.imul(mixed, 0x846ca68b);
    mixed ^= mixed >>> 16;
    return (mixed >>> 0).toString(16).padStart(8, '0');
  }).join('');
}
