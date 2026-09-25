import { describe, expect, it } from 'vitest';
import { projectClaimsInbox, type ClaimsInboxInput } from './claimsInbox.js';

const now = '2026-09-25T12:00:00.000Z';
const provenance = {
  state: 'USER_DECLARED' as const,
  sourceType: 'USER' as const,
  sourceId: 'founder:1',
  evidence: [],
  observedAt: now,
};
const claim = (id: string, overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 'rights-claim.v1' as const,
  id,
  targetEntityId: 'recording:canonical-1',
  claimantEntityId: 'person:1',
  type: 'MASTER' as const,
  status: 'ASSERTED' as const,
  territoryCodes: ['US'],
  provenance,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});
const event = (id: string, eventType: 'claim.received' | 'claim.status_changed', claimId: string) => ({
  schemaVersion: 'music-domain-event.v1' as const,
  eventId: id,
  eventType,
  subject: { entityId: claimId, entityType: 'rights_claim' as const },
  relatedEntities: [{ entityId: 'recording:canonical-1', entityType: 'sound_recording' as const }],
  occurredAt: now,
  recordedAt: now,
  provenance: { ...provenance, state: 'DETECTED' as const, sourceType: 'EXTERNAL_SERVICE' as const, sourceId: 'platform:1' },
});
const input = (overrides: Partial<ClaimsInboxInput> = {}): ClaimsInboxInput => ({
  claims: [claim('claim:1')],
  events: [],
  evaluatedAt: now,
  ...overrides,
});

describe('claims inbox projection', () => {
  it('rejects external identifier namespaces as canonical claim targets', () => {
    for (const targetEntityId of ['grid:GRID-123', 'catalog_number:legacy-7', 'platform_id:spotify-123', 'proprietary:label-123']) {
      expect(() => projectClaimsInbox(input({ claims: [claim('claim:1', { targetEntityId })] }))).toThrow(/canonical claim or entity IDs/i);
    }
  });

  it('joins canonical claims to Phase 11 events while preserving their provenance and evidence boundary', () => {
    const evidence = { id: 'evidence:1', type: 'DOCUMENT' as const, contentSha256: 'a'.repeat(64) };
    const asserted = claim('claim:1', { provenance: { ...provenance, evidence: [evidence] } });
    const projected = projectClaimsInbox(input({ claims: [asserted], events: [event('event:1', 'claim.received', 'claim:1')] }));

    expect(projected.items).toHaveLength(1);
    expect(projected.items[0]).toMatchObject({
      claim: { id: 'claim:1', status: 'ASSERTED', provenance: { state: 'USER_DECLARED', evidence: [evidence] } },
      sourceEvents: [{ eventId: 'event:1', eventType: 'claim.received', provenance: { state: 'DETECTED' } }],
      queueStatus: 'REVIEW_REQUIRED',
      reviewReasons: ['CLAIM_RECEIVED'],
      evidenceCount: 1,
      requiresHumanReview: true,
    });
    expect(projected.items[0]?.claim.status).toBe('ASSERTED');
  });

  it('flags distinct claimant assertions with potentially overlapping scope without deciding ownership', () => {
    const first = claim('claim:1', { sharePercentage: 100 });
    const second = claim('claim:2', { claimantEntityId: 'organization:2', sharePercentage: 100 });
    const projected = projectClaimsInbox(input({ claims: [second, first] }));

    expect(projected.potentialConflicts).toEqual([expect.objectContaining({
      firstClaimId: 'claim:1', secondClaimId: 'claim:2', targetEntityId: 'recording:canonical-1',
      reason: 'DIFFERENT_CLAIMANTS_WITH_POSSIBLY_OVERLAPPING_SCOPE', requiresHumanReview: true,
    })]);
    expect(projected.items.map(item => item.hasPotentialConflict)).toEqual([true, true]);
    expect(projected.items.every(item => item.claim.status === 'ASSERTED' && item.requiresHumanReview)).toBe(true);
  });

  it('produces the same inbox ordering regardless of input record order', () => {
    const first = claim('claim:1', { updatedAt: '2026-09-24T12:00:00.000Z' });
    const second = claim('claim:2', {
      claimantEntityId: 'organization:2', updatedAt: '2026-09-25T10:00:00.000Z',
    });
    const firstEvent = event('event:1', 'claim.received', 'claim:1');
    const secondEvent = event('event:2', 'claim.status_changed', 'claim:1');

    const forward = projectClaimsInbox(input({ claims: [first, second], events: [firstEvent, secondEvent] }));
    const reversed = projectClaimsInbox(input({ claims: [second, first], events: [secondEvent, firstEvent] }));

    expect(reversed).toEqual(forward);
  });

  it('does not report a potential conflict for disjoint territory or validity windows', () => {
    const usClaim = claim('claim:1', { validFrom: '2020-01-01', validThrough: '2022-12-31' });
    const gbClaim = claim('claim:2', {
      claimantEntityId: 'organization:2', territoryCodes: ['GB'],
      validFrom: '2023-01-01', validThrough: '2024-12-31',
    });
    const projected = projectClaimsInbox(input({ claims: [usClaim, gbClaim] }));

    expect(projected.potentialConflicts).toEqual([]);
    expect(projected.items.every(item => !item.hasPotentialConflict)).toBe(true);
  });

  it('treats an explicit worldwide territory as possibly overlapping a regional assertion', () => {
    const worldwide = claim('claim:1', { territoryCodes: ['Worldwide'] });
    const us = claim('claim:2', { claimantEntityId: 'organization:2', territoryCodes: ['US'] });

    expect(projectClaimsInbox(input({ claims: [worldwide, us] })).potentialConflicts).toHaveLength(1);
  });

  it('keeps withdrawn claims visible for human closure review and never uses them to create conflicts', () => {
    const active = claim('claim:active');
    const withdrawn = claim('claim:withdrawn', {
      claimantEntityId: 'organization:2', status: 'WITHDRAWN',
    });
    const projected = projectClaimsInbox(input({ claims: [active, withdrawn] }));

    expect(projected.potentialConflicts).toEqual([]);
    expect(projected.items.find(item => item.claim.id === 'claim:withdrawn')).toMatchObject({
      queueStatus: 'REVIEW_REQUIRED', requiresHumanReview: true,
      reviewReasons: ['CLAIM_WITHDRAWN', 'EVIDENCE_NOT_ATTACHED'],
    });
  });

  it('surfaces explicit dispute, missing claimant, and missing evidence as review reasons', () => {
    const disputed = claim('claim:1', {
      claimantEntityId: undefined,
      status: 'DISPUTED',
      provenance: { ...provenance, state: 'DISPUTED' },
    });
    const projected = projectClaimsInbox(input({ claims: [disputed] }));

    expect(projected.items[0]?.reviewReasons).toEqual(expect.arrayContaining([
      'EXPLICITLY_DISPUTED', 'EVIDENCE_NOT_ATTACHED', 'CLAIMANT_NOT_IDENTIFIED',
    ]));
    expect(projected.items[0]?.queueStatus).toBe('REVIEW_REQUIRED');
  });

  it('ignores unmatched events and rejects duplicate canonical IDs', () => {
    const projected = projectClaimsInbox(input({ events: [event('event:orphan', 'claim.received', 'claim:missing')] }));
    expect(projected.items[0]?.sourceEvents).toEqual([]);
    expect(() => projectClaimsInbox(input({ claims: [claim('claim:1'), claim('claim:1')] }))).toThrow(/Claim IDs must be unique/);
    expect(() => projectClaimsInbox(input({ claims: [claim('claim:1', { targetEntityId: 'USABC2600001' })] }))).toThrow(/External identifier values/);
    expect(() => projectClaimsInbox(input({ claims: [claim('USABC2600001')] }))).toThrow(/External identifier values/);
  });

  it('bounds conflict details without truncating per-claim conflict presence', () => {
    const claims = Array.from({ length: 102 }, (_, index) => claim(`claim:${String(index).padStart(3, '0')}`, {
      claimantEntityId: `person:${index}`,
    }));
    const projected = projectClaimsInbox(input({ claims }));

    expect(projected.potentialConflicts).toHaveLength(5_000);
    expect(projected.conflictsTruncated).toBe(true);
    expect(projected.items.every(item => item.hasPotentialConflict)).toBe(true);
  });
});
