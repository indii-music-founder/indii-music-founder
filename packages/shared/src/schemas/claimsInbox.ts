import { z } from 'zod';
import { RightsClaimSchema, RightsClaimTypeSchema, type RightsClaim } from './musicEntity.js';
import { MusicDomainEventSchema, type MusicDomainEvent } from './musicEvent.js';

const IsoDateTimeSchema = z.string().datetime();
const ClaimEventTypes = new Set(['claim.received', 'claim.status_changed']);
const MaximumClaims = 2_000;
const MaximumConflicts = 5_000;
const externalIdentifierPrefixes = /^(?:isrc|iswc|upc|ean|isni|ipi|dpid|spotify|apple(?:_music)?|youtube|tiktok|instagram):/i;
const externalIdentifierValue = /^(?:[A-Z]{2}[A-Z0-9]{3}\d{7}|T-\d{3}\.\d{3}\.\d{3}-\d|\d{8,14})$/i;

function isCanonicalEntityId(value: string): boolean {
  return !externalIdentifierPrefixes.test(value) && !externalIdentifierValue.test(value);
}
const CanonicalEntityIdSchema = z.string().trim().min(1).max(160).refine(isCanonicalEntityId, {
  message: 'External identifier values must remain identifiers and cannot be canonical claim or entity IDs.',
});

export const ClaimsInboxInputSchema = z.object({
  claims: z.array(RightsClaimSchema).max(MaximumClaims),
  events: z.array(MusicDomainEventSchema).max(10_000).default([]),
  evaluatedAt: IsoDateTimeSchema,
}).strict().superRefine((input, ctx) => {
  const claimIds = new Set<string>();
  input.claims.forEach((claim, index) => {
    for (const [field, id] of Object.entries({
      id: claim.id,
      targetEntityId: claim.targetEntityId,
      ...(claim.claimantEntityId ? { claimantEntityId: claim.claimantEntityId } : {}),
    })) {
      if (!isCanonicalEntityId(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['claims', index, field],
          message: 'External identifier values must remain identifiers and cannot be canonical claim or entity IDs.',
        });
      }
    }
    if (claimIds.has(claim.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['claims', index, 'id'], message: 'Claim IDs must be unique in one inbox projection.' });
    }
    claimIds.add(claim.id);
  });

  const eventIds = new Set<string>();
  input.events.forEach((event, index) => {
    if (eventIds.has(event.eventId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['events', index, 'eventId'], message: 'Event IDs must be unique in one inbox projection.' });
    }
    eventIds.add(event.eventId);
  });
});
export type ClaimsInboxInput = z.input<typeof ClaimsInboxInputSchema>;

export const ClaimsInboxReviewReasonSchema = z.enum([
  'CLAIM_RECEIVED',
  'CLAIM_STATUS_CHANGED',
  'POTENTIAL_OVERLAPPING_ASSERTION',
  'EXPLICITLY_DISPUTED',
  'CLAIM_WITHDRAWN',
  'EVIDENCE_NOT_ATTACHED',
  'CLAIMANT_NOT_IDENTIFIED',
  'STATUS_UNKNOWN',
]);
export type ClaimsInboxReviewReason = z.infer<typeof ClaimsInboxReviewReasonSchema>;

export const ClaimsInboxItemSchema = z.object({
  claim: RightsClaimSchema,
  sourceEvents: z.array(MusicDomainEventSchema).max(10_000),
  queueStatus: z.literal('REVIEW_REQUIRED'),
  reviewReasons: z.array(ClaimsInboxReviewReasonSchema).max(8),
  hasPotentialConflict: z.boolean(),
  /** Evidence presence is surfaced only; it is never a legal or ownership verdict. */
  evidenceCount: z.number().int().min(0).max(100),
  requiresHumanReview: z.literal(true),
}).strict().superRefine((item, ctx) => {
  for (const [field, id] of Object.entries({
    id: item.claim.id,
    targetEntityId: item.claim.targetEntityId,
    ...(item.claim.claimantEntityId ? { claimantEntityId: item.claim.claimantEntityId } : {}),
  })) {
    if (!isCanonicalEntityId(id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['claim', field], message: 'External identifier values cannot be canonical claim or entity IDs.' });
    }
  }
  if (item.evidenceCount !== item.claim.provenance.evidence.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['evidenceCount'], message: 'Evidence count must reflect the claim provenance references.' });
  }
});
export type ClaimsInboxItem = z.infer<typeof ClaimsInboxItemSchema>;

export const PotentialClaimConflictSchema = z.object({
  firstClaimId: CanonicalEntityIdSchema,
  secondClaimId: CanonicalEntityIdSchema,
  targetEntityId: CanonicalEntityIdSchema,
  claimType: RightsClaimTypeSchema,
  reason: z.literal('DIFFERENT_CLAIMANTS_WITH_POSSIBLY_OVERLAPPING_SCOPE'),
  requiresHumanReview: z.literal(true),
}).strict().superRefine((conflict, ctx) => {
  if (conflict.firstClaimId >= conflict.secondClaimId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['firstClaimId'], message: 'Conflict claim IDs must be unique and lexically ordered.' });
  }
});
export type PotentialClaimConflict = z.infer<typeof PotentialClaimConflictSchema>;

export const ClaimsInboxProjectionSchema = z.object({
  schemaVersion: z.literal('claims-inbox.v1'),
  evaluatedAt: IsoDateTimeSchema,
  items: z.array(ClaimsInboxItemSchema).max(MaximumClaims),
  potentialConflicts: z.array(PotentialClaimConflictSchema).max(MaximumConflicts),
  conflictsTruncated: z.boolean(),
}).strict();
export type ClaimsInboxProjection = z.infer<typeof ClaimsInboxProjectionSchema>;

interface PreparedClaimScope {
  claim: RightsClaim;
  territoryCodes: Set<string>;
  worldScope: boolean;
  startsAt: number;
  endsAt: number;
}

function prepareClaimScope(claim: RightsClaim): PreparedClaimScope {
  const territoryCodes = new Set(claim.territoryCodes.map(code => code.trim().toUpperCase()));
  const worldScope = territoryCodes.has('WW') || territoryCodes.has('WORLDWIDE') || territoryCodes.has('001');
  return {
    claim,
    territoryCodes,
    worldScope,
    startsAt: claim.validFrom ? Date.parse(claim.validFrom) : Number.NEGATIVE_INFINITY,
    endsAt: claim.validThrough ? Date.parse(claim.validThrough) : Number.POSITIVE_INFINITY,
  };
}

function scopesMayOverlap(first: PreparedClaimScope, second: PreparedClaimScope): boolean {
  const territoriesMayOverlap = first.territoryCodes.size === 0
    || second.territoryCodes.size === 0
    || first.worldScope
    || second.worldScope
    || [...first.territoryCodes].some(code => second.territoryCodes.has(code));
  if (!territoriesMayOverlap) return false;

  return Math.max(first.startsAt, second.startsAt) <= Math.min(first.endsAt, second.endsAt);
}

/**
 * Builds a platform-neutral, advisory claims inbox from canonical claim records
 * and Phase 11 claim events. A potential conflict means only that distinct,
 * identified claimants asserted the same right over a scope that may overlap;
 * co-ownership may be legitimate, so this function never decides ownership or
 * changes any claim status. The bounded output is a read model, not persistence.
 */
export function projectClaimsInbox(input: ClaimsInboxInput): ClaimsInboxProjection {
  const parsed = ClaimsInboxInputSchema.parse(input);
  const claims = [...parsed.claims].sort((a, b) => a.id.localeCompare(b.id));
  const claimsById = new Map(claims.map(claim => [claim.id, claim]));
  const eventsByClaim = new Map<string, MusicDomainEvent[]>();

  for (const event of parsed.events) {
    if (!ClaimEventTypes.has(event.eventType) || event.subject.entityType !== 'rights_claim') continue;
    if (!claimsById.has(event.subject.entityId)) continue;
    const associated = eventsByClaim.get(event.subject.entityId) ?? [];
    associated.push(event);
    eventsByClaim.set(event.subject.entityId, associated);
  }
  for (const associated of eventsByClaim.values()) {
    associated.sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.eventId.localeCompare(b.eventId));
  }

  const activeClaims = claims.filter(claim => claim.status !== 'WITHDRAWN');
  const claimsByScope = new Map<string, PreparedClaimScope[]>();
  for (const claim of activeClaims) {
    if (!claim.claimantEntityId) continue;
    const key = JSON.stringify([claim.targetEntityId, claim.type]);
    const group = claimsByScope.get(key) ?? [];
    group.push(prepareClaimScope(claim));
    claimsByScope.set(key, group);
  }

  const conflictClaimIds = new Set<string>();
  const potentialConflicts: PotentialClaimConflict[] = [];
  let conflictsTruncated = false;
  for (const group of [...claimsByScope.values()].map(items => items.sort((a, b) => a.claim.id.localeCompare(b.claim.id)))) {
    for (let firstIndex = 0; firstIndex < group.length - 1; firstIndex += 1) {
      const first = group[firstIndex]!;
      for (let secondIndex = firstIndex + 1; secondIndex < group.length; secondIndex += 1) {
        const second = group[secondIndex]!;
        if (first.claim.claimantEntityId === second.claim.claimantEntityId || !scopesMayOverlap(first, second)) continue;
        conflictClaimIds.add(first.claim.id);
        conflictClaimIds.add(second.claim.id);
        if (potentialConflicts.length < MaximumConflicts) {
          potentialConflicts.push(PotentialClaimConflictSchema.parse({
            firstClaimId: first.claim.id,
            secondClaimId: second.claim.id,
            targetEntityId: first.claim.targetEntityId,
            claimType: first.claim.type,
            reason: 'DIFFERENT_CLAIMANTS_WITH_POSSIBLY_OVERLAPPING_SCOPE',
            requiresHumanReview: true,
          }));
        } else {
          conflictsTruncated = true;
        }
      }
    }
  }

  const items = claims.map(claim => {
    const sourceEvents = eventsByClaim.get(claim.id) ?? [];
    const reviewReasons = new Set<ClaimsInboxReviewReason>();
    if (sourceEvents.some(event => event.eventType === 'claim.received')) reviewReasons.add('CLAIM_RECEIVED');
    if (sourceEvents.some(event => event.eventType === 'claim.status_changed')) reviewReasons.add('CLAIM_STATUS_CHANGED');
    if (conflictClaimIds.has(claim.id)) reviewReasons.add('POTENTIAL_OVERLAPPING_ASSERTION');
    if (claim.status === 'DISPUTED' || claim.provenance.state === 'DISPUTED') reviewReasons.add('EXPLICITLY_DISPUTED');
    if (claim.status === 'WITHDRAWN') reviewReasons.add('CLAIM_WITHDRAWN');
    if (claim.provenance.evidence.length === 0) reviewReasons.add('EVIDENCE_NOT_ATTACHED');
    if (!claim.claimantEntityId) reviewReasons.add('CLAIMANT_NOT_IDENTIFIED');
    if (claim.status === 'UNKNOWN') reviewReasons.add('STATUS_UNKNOWN');

    const queueStatus = 'REVIEW_REQUIRED' as const;
    return ClaimsInboxItemSchema.parse({
      claim,
      sourceEvents,
      queueStatus,
      reviewReasons: [...reviewReasons],
      hasPotentialConflict: conflictClaimIds.has(claim.id),
      evidenceCount: claim.provenance.evidence.length,
      requiresHumanReview: true,
    });
  }).sort((a, b) => Date.parse(b.claim.updatedAt) - Date.parse(a.claim.updatedAt) || a.claim.id.localeCompare(b.claim.id));

  return ClaimsInboxProjectionSchema.parse({
    schemaVersion: 'claims-inbox.v1',
    evaluatedAt: parsed.evaluatedAt,
    items,
    potentialConflicts,
    conflictsTruncated,
  });
}
