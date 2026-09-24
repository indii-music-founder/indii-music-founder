import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import {
  evaluateConnectedIntelligence,
  ConnectedIntelligenceInputSchema,
} from './connectedIntelligence.js';
import { planConnectedIntelligenceAction } from './musicActionExecution.js';
import { createMusicEventDelivery, transitionMusicEventDelivery } from './musicEventDelivery.js';

const now = '2026-09-24T16:00:00.000Z';
const evidence = [{ id: 'evidence:source-1', type: 'EXTERNAL_RECORD' as const, description: 'Synthetic fixture evidence' }];
const verified = {
  state: 'EXTERNAL_VERIFIED' as const,
  sourceType: 'EXTERNAL_SERVICE' as const,
  sourceId: 'fixture:provider',
  evidence,
  observedAt: now,
};
const userVerified = {
  state: 'USER_CONFIRMED' as const,
  sourceType: 'USER' as const,
  sourceId: 'fixture:review',
  evidence,
  observedAt: now,
  confirmedAt: now,
};

type ConnectedInput = z.input<typeof ConnectedIntelligenceInputSchema>;
type CompleteFixture = Omit<ConnectedInput,
  'entities' | 'relationships' | 'rightsReports' | 'registrationRequirements' | 'platformTerritoryTargets' | 'platformTerritoryReadiness'
> & {
  entities: NonNullable<ConnectedInput['entities']>;
  relationships: NonNullable<ConnectedInput['relationships']>;
  rightsReports: NonNullable<ConnectedInput['rightsReports']>;
  registrationRequirements: NonNullable<ConnectedInput['registrationRequirements']>;
  platformTerritoryTargets: NonNullable<ConnectedInput['platformTerritoryTargets']>;
  platformTerritoryReadiness: NonNullable<ConnectedInput['platformTerritoryReadiness']>;
};

function completeFixture(overrides: Partial<CompleteFixture> = {}): CompleteFixture {
  return {
    event: {
      schemaVersion: 'music-domain-event.v1',
      eventId: 'event:release-planned-1',
      eventType: 'release.planned',
      subject: { entityId: 'release:canonical-1', entityType: 'release' },
      relatedEntities: [
        { entityId: 'artist:canonical-1', entityType: 'artist' },
        { entityId: 'platform:canonical-1', entityType: 'platform' },
      ],
      occurredAt: now,
      recordedAt: now,
      provenance: { ...verified, state: 'DETECTED', confidence: 0.98 },
    },
    artistContext: {
      schemaVersion: 'artist-context.v1',
      artistEntityId: 'artist:canonical-1',
      facts: {},
      updatedAt: now,
    },
    entities: [
      { schemaVersion: 'canonical-music-entity.v1', id: 'release:canonical-1', entityType: 'release', title: 'Synthetic Release', releaseType: 'SINGLE', createdAt: now, updatedAt: now },
      { schemaVersion: 'canonical-music-entity.v1', id: 'artist:canonical-1', entityType: 'artist', displayName: 'Synthetic Artist', createdAt: now, updatedAt: now },
      { schemaVersion: 'canonical-music-entity.v1', id: 'recording:canonical-1', entityType: 'sound_recording', title: 'Synthetic Track', recordingKind: 'ORIGINAL', createdAt: now, updatedAt: now },
      { schemaVersion: 'canonical-music-entity.v1', id: 'work:canonical-1', entityType: 'musical_work', title: 'Synthetic Work', createdAt: now, updatedAt: now },
    ],
    relationships: [
      { schemaVersion: 'music-relationship.v1', id: 'relationship:release-recording', fromEntityId: 'recording:canonical-1', toEntityId: 'release:canonical-1', type: 'INCLUDED_ON', status: 'ACTIVE', provenance: userVerified, createdAt: now, updatedAt: now },
      { schemaVersion: 'music-relationship.v1', id: 'relationship:artist-recording', fromEntityId: 'artist:canonical-1', toEntityId: 'recording:canonical-1', type: 'PERFORMED_ON', status: 'ACTIVE', provenance: userVerified, createdAt: now, updatedAt: now },
    ],
    rightsReports: [{
      schemaVersion: 'rights-intelligence.v1', targetEntityId: 'recording:canonical-1',
      masterShareTotal: 100, compositionShareTotal: 100, publisherShareTotal: 0,
      findings: [], releaseReviewRequired: false, contentIdAutomaticSubmissionEligible: true, evaluatedAt: now,
    }],
    registrationRequirements: [{
      requirementId: 'requirement:pro-registration',
      subject: { entityId: 'work:canonical-1', entityType: 'musical_work' },
      registrationType: 'PRO', required: true, status: 'CONFIRMED', verification: 'HUMAN_VERIFIED',
      provenance: userVerified, evidence,
    }],
    platformTerritoryTargets: [{ platform: { entityId: 'platform:canonical-1', entityType: 'platform' }, territoryCode: 'US' }],
    platformTerritoryReadiness: [{
      platform: { entityId: 'platform:canonical-1', entityType: 'platform' }, territoryCode: 'US',
      status: 'READY', checkedAt: now, provenance: verified, evidence,
    }],
    freshnessPolicy: { rightsReportMaxAgeMs: 86_400_000, registrationMaxAgeMs: 86_400_000, platformReadinessMaxAgeMs: 86_400_000 },
    evaluatedAt: now,
    ...overrides,
  };
}

describe('Phase 9 connected intelligence preflight', () => {
  it('returns an explicit no-action-required outcome when every required input is current and verified', () => {
    const result = evaluateConnectedIntelligence(completeFixture());
    expect(result.status).toBe('NO_ACTION_REQUIRED');
    expect(result.actions).toEqual([]);
    expect(result.evaluatedDimensions).toContain('TERRITORY_PLATFORM');
    expect(result.actions.every(action => action.subjectEntityId === action.subject.entityId)).toBe(true);
  });

  it('does not interpret a detected event as proof, but may use it as a re-evaluation trigger', () => {
    const result = evaluateConnectedIntelligence(completeFixture());
    expect(result.status).toBe('NO_ACTION_REQUIRED');
    expect(result.sourceEventId).toBe('event:release-planned-1');
  });

  it('does not promote provider registration confirmation to human verification', () => {
    const input = completeFixture({
      registrationRequirements: [{
        requirementId: 'requirement:pro-registration', subject: { entityId: 'work:canonical-1', entityType: 'musical_work' },
        registrationType: 'PRO', required: true, status: 'CONFIRMED', verification: 'PROVIDER_CONFIRMED',
        provenance: verified, evidence,
      }],
    });
    const result = evaluateConnectedIntelligence(input);
    expect(result.status).toBe('ACTIONS_REQUIRED');
    expect(result.actions.map(action => action.code)).toContain('VERIFY_REGISTRATION');
    expect(result.actions.find(action => action.code === 'VERIFY_REGISTRATION')?.detail).toMatch(/does not establish rights ownership/);
  });

  it('preserves separate PRO and MLC advisories for the same musical work', () => {
    const input = completeFixture({
      registrationRequirements: ['PRO', 'MLC'].map(registrationType => ({
        requirementId: `requirement:${registrationType.toLowerCase()}`,
        subject: { entityId: 'work:canonical-1', entityType: 'musical_work' as const },
        registrationType: registrationType as 'PRO' | 'MLC',
        required: true,
        status: 'SUBMITTED' as const,
        verification: 'PROVIDER_CONFIRMED' as const,
        provenance: verified,
        evidence,
      })),
    });
    const actions = evaluateConnectedIntelligence(input).actions.filter(action => action.code === 'VERIFY_REGISTRATION');
    expect(actions).toHaveLength(2);
    expect(actions.map(action => action.title)).toEqual(expect.arrayContaining([
      'Verify the PRO registration status',
      'Verify the MLC registration status',
    ]));
    expect(new Set(actions.map(action => action.actionId)).size).toBe(2);
    expect(actions.every(action => action.actionId.length <= 160)).toBe(true);
    expect(actions.every(action => action.evidence.length === evidence.length)).toBe(true);
  });

  it('rejects stale rights, registration, and platform readiness snapshots', () => {
    const old = '2026-09-22T16:00:00.000Z';
    const input = completeFixture({
      rightsReports: [{
        schemaVersion: 'rights-intelligence.v1', targetEntityId: 'recording:canonical-1', masterShareTotal: 100,
        compositionShareTotal: 100, publisherShareTotal: 0, findings: [], releaseReviewRequired: false,
        contentIdAutomaticSubmissionEligible: true, evaluatedAt: old,
      }],
      registrationRequirements: [{
        requirementId: 'requirement:pro-registration', subject: { entityId: 'work:canonical-1', entityType: 'musical_work' },
        registrationType: 'PRO', required: true, status: 'CONFIRMED', verification: 'HUMAN_VERIFIED',
        provenance: { ...userVerified, observedAt: old }, evidence,
      }],
      platformTerritoryReadiness: [{
        platform: { entityId: 'platform:canonical-1', entityType: 'platform' }, territoryCode: 'US',
        status: 'READY', checkedAt: old, provenance: verified, evidence,
      }],
    });
    const result = evaluateConnectedIntelligence(input);
    expect(result.actions.map(action => action.code)).toEqual(expect.arrayContaining([
      'REVIEW_RIGHTS', 'VERIFY_REGISTRATION', 'VERIFY_PLATFORM_TERRITORY',
    ]));
  });

  it('surfaces missing and non-authoritative relationships without treating DDEX-style assertions as identity merges', () => {
    const input = completeFixture({
      relationships: [{
        schemaVersion: 'music-relationship.v1', id: 'relationship:unverified',
        fromEntityId: 'recording:canonical-1', toEntityId: 'release:canonical-1', type: 'INCLUDED_ON', status: 'ACTIVE',
        provenance: { state: 'INFERRED', sourceType: 'AGENT', evidence: [], observedAt: now }, createdAt: now, updatedAt: now,
      }],
    });
    const result = evaluateConnectedIntelligence(input);
    expect(result.actions.map(action => action.code)).toContain('VERIFY_MUSIC_RELATIONSHIP');
  });

  it('keeps a disputed release membership visible even when another active membership exists', () => {
    const input = completeFixture({
      entities: [
        ...completeFixture().entities,
        { schemaVersion: 'canonical-music-entity.v1', id: 'recording:canonical-2', entityType: 'sound_recording', title: 'Other Synthetic Track', recordingKind: 'ORIGINAL', createdAt: now, updatedAt: now },
        { schemaVersion: 'canonical-music-entity.v1', id: 'recording:canonical-3', entityType: 'sound_recording', title: 'Third Synthetic Track', recordingKind: 'ORIGINAL', createdAt: now, updatedAt: now },
      ],
      relationships: [
        ...completeFixture().relationships,
        { schemaVersion: 'music-relationship.v1', id: 'relationship:disputed-track', fromEntityId: 'recording:canonical-2', toEntityId: 'release:canonical-1', type: 'INCLUDED_ON', status: 'DISPUTED', provenance: { state: 'DISPUTED', sourceType: 'USER', evidence, observedAt: now }, createdAt: now, updatedAt: now },
        { schemaVersion: 'music-relationship.v1', id: 'relationship:disputed-track-3', fromEntityId: 'recording:canonical-3', toEntityId: 'release:canonical-1', type: 'INCLUDED_ON', status: 'DISPUTED', provenance: { state: 'DISPUTED', sourceType: 'USER', evidence: [{ id: 'evidence:source-3', type: 'EXTERNAL_RECORD', description: 'Second disputed relation evidence' }], observedAt: now }, createdAt: now, updatedAt: now },
      ],
    });
    const result = evaluateConnectedIntelligence(input);
    const disputedActions = result.actions.filter(action => action.code === 'VERIFY_MUSIC_RELATIONSHIP' && action.detail.includes('disputed'));
    expect(disputedActions).toHaveLength(2);
    expect(new Set(disputedActions.map(action => action.actionId)).size).toBe(2);
    expect(disputedActions.map(action => action.evidence[0]?.id)).toEqual(expect.arrayContaining([
      'evidence:source-1', 'evidence:source-3',
    ]));
  });

  it('preserves separate blocked readiness advisories for each normalized platform territory', () => {
    const input = completeFixture({
      platformTerritoryTargets: ['US', 'CA'].map(territoryCode => ({
        platform: { entityId: 'platform:canonical-1', entityType: 'platform' as const }, territoryCode,
      })),
      platformTerritoryReadiness: ['US', 'CA'].map(territoryCode => ({
        platform: { entityId: 'platform:canonical-1', entityType: 'platform' as const },
        territoryCode,
        status: 'BLOCKED' as const,
        checkedAt: now,
        provenance: verified,
        evidence: [{ id: `evidence:blocked-${territoryCode}`, type: 'EXTERNAL_RECORD' as const }],
      })),
    });
    const actions = evaluateConnectedIntelligence(input).actions.filter(action => action.code === 'RESOLVE_PLATFORM_TERRITORY');
    expect(actions).toHaveLength(2);
    expect(actions.map(action => action.detail)).toEqual(expect.arrayContaining([
      'Verified platform readiness is blocked for US.',
      'Verified platform readiness is blocked for CA.',
    ]));
    expect(new Set(actions.map(action => action.actionId)).size).toBe(2);
    expect(actions.flatMap(action => action.evidence.map(item => item.id))).toEqual(expect.arrayContaining([
      'evidence:blocked-US', 'evidence:blocked-CA',
    ]));
  });

  it('fails closed when a rights report has a human-review finding but a false summary flag', () => {
    const input = completeFixture({
      rightsReports: [{
        schemaVersion: 'rights-intelligence.v1', targetEntityId: 'recording:canonical-1',
        masterShareTotal: 100, compositionShareTotal: 100, publisherShareTotal: 0,
        findings: [{ code: 'RIGHTS_INTEREST_UNRESOLVED', severity: 'REVIEW', entityId: 'recording:canonical-1', message: 'Synthetic unresolved assertion', requiresHumanReview: true }],
        releaseReviewRequired: false, contentIdAutomaticSubmissionEligible: true, evaluatedAt: now,
      }],
    });
    const result = evaluateConnectedIntelligence(input);
    expect(result.actions.map(action => action.code)).toContain('REVIEW_RIGHTS');
  });

  it('does not accept detected platform availability as authoritative readiness', () => {
    const input = completeFixture({
      platformTerritoryReadiness: [{
        platform: { entityId: 'platform:canonical-1', entityType: 'platform' }, territoryCode: 'US',
        status: 'READY', checkedAt: now, provenance: { state: 'DETECTED', sourceType: 'SYSTEM', evidence: [], observedAt: now }, evidence: [],
      }],
    });
    const result = evaluateConnectedIntelligence(input);
    expect(result.actions.map(action => action.code)).toContain('VERIFY_PLATFORM_TERRITORY');
  });

  it('requires explicit registration and target scope before claiming completeness', () => {
    const result = evaluateConnectedIntelligence(completeFixture({ registrationRequirements: [], platformTerritoryTargets: [] }));
    expect(result.status).toBe('ACTIONS_REQUIRED');
    expect(result.actions.map(action => action.code)).toEqual(expect.arrayContaining([
      'SPECIFY_REGISTRATION_SCOPE', 'SELECT_PLATFORM_TERRITORY_SCOPE',
    ]));
  });

  it('does not report no-action-required for unsupported event types', () => {
    const input = completeFixture({
      event: {
        schemaVersion: 'music-domain-event.v1', eventId: 'event:performance', eventType: 'performance.planned',
        subject: { entityId: 'usage:performance-1', entityType: 'usage' }, occurredAt: now, recordedAt: now,
        provenance: { ...verified, state: 'DETECTED' },
      },
    });
    const result = evaluateConnectedIntelligence(input);
    expect(result.status).toBe('NOT_EVALUATED');
    expect(result.actions).toEqual([]);
  });

  it('uses a monitored status change to re-evaluate the related release snapshot', () => {
    const input = completeFixture({
      event: {
        schemaVersion: 'music-domain-event.v1',
        eventId: 'event:registration-status-1',
        eventType: 'registration.status_changed',
        subject: { entityId: 'registration:internal-1', entityType: 'registration' },
        relatedEntities: [
          { entityId: 'release:canonical-1', entityType: 'release' },
          { entityId: 'work:canonical-1', entityType: 'musical_work' },
        ],
        occurredAt: now,
        recordedAt: now,
        details: { status: 'SUBMITTED' },
        provenance: { ...verified, state: 'DETECTED' },
      },
      registrationRequirements: [{
        requirementId: 'requirement:pro-registration', subject: { entityId: 'work:canonical-1', entityType: 'musical_work' },
        registrationType: 'PRO', required: true, status: 'SUBMITTED', verification: 'PROVIDER_CONFIRMED',
        provenance: verified, evidence,
      }],
    });
    const result = evaluateConnectedIntelligence(input);
    expect(result.sourceEventId).toBe('event:registration-status-1');
    expect(result.status).toBe('ACTIONS_REQUIRED');
    expect(result.actions.map(action => action.code)).toContain('VERIFY_REGISTRATION');
  });

  it('carries a monitoring event through delivery, readiness re-evaluation, and a human-gated Phase 10 plan', () => {
    const monitoredEvent = {
      schemaVersion: 'music-domain-event.v1' as const,
      eventId: 'event:registration-status-delivery-1',
      eventType: 'registration.status_changed' as const,
      subject: { entityId: 'registration:internal-1', entityType: 'registration' as const },
      relatedEntities: [
        { entityId: 'release:canonical-1', entityType: 'release' as const },
        { entityId: 'work:canonical-1', entityType: 'musical_work' as const },
      ],
      occurredAt: now,
      recordedAt: now,
      details: { status: 'SUBMITTED' },
      provenance: { ...verified, state: 'DETECTED' as const },
    };
    const pending = createMusicEventDelivery({ event: monitoredEvent, consumerId: 'connected-intelligence', createdAt: now });
    const inFlight = transitionMusicEventDelivery(pending, {
      type: 'CLAIM', leaseId: 'lease:connected-intelligence', now, leaseDurationMs: 60_000,
    });
    const delivered = transitionMusicEventDelivery(inFlight, {
      type: 'ACKNOWLEDGE', leaseId: 'lease:connected-intelligence', now: '2026-09-24T16:00:01.000Z',
    });
    const evaluation = evaluateConnectedIntelligence(completeFixture({
      event: delivered.event,
      registrationRequirements: [{
        requirementId: 'requirement:pro-registration', subject: { entityId: 'work:canonical-1', entityType: 'musical_work' },
        registrationType: 'PRO', required: true, status: 'SUBMITTED', verification: 'PROVIDER_CONFIRMED',
        provenance: verified, evidence,
      }],
    }));
    const advisory = evaluation.actions.find(action => action.code === 'VERIFY_REGISTRATION');
    expect(delivered.status).toBe('DELIVERED');
    expect(evaluation.status).toBe('ACTIONS_REQUIRED');
    expect(advisory).toBeDefined();
    const plan = planConnectedIntelligenceAction(advisory!, {
      officialApiAvailable: true,
      oauthApiAvailable: true,
      browserAutomationAvailable: true,
      desktopControlAvailable: true,
      autonomousComputerControlAuthorized: true,
    });
    expect(plan.route).toBe('GUIDED_MANUAL');
    expect(plan.status).toBe('AWAITING_HUMAN');
    expect(plan.executionAuthorized).toBe(false);
  });

  it('does not infer which release a monitoring event affected when no release reference is present', () => {
    const input = completeFixture({
      event: {
        schemaVersion: 'music-domain-event.v1',
        eventId: 'event:delivery-status-unlinked',
        eventType: 'delivery.status_changed',
        subject: { entityId: 'delivery:internal-1', entityType: 'delivery' },
        occurredAt: now,
        recordedAt: now,
        provenance: { ...verified, state: 'DETECTED' },
      },
    });
    const result = evaluateConnectedIntelligence(input);
    expect(result.status).toBe('NOT_EVALUATED');
    expect(result.actions).toEqual([]);
    expect(result.explanation).toMatch(/does not identify an affected canonical release/);
  });

  it('emits only advisory actions that require human review and authorize no execution', () => {
    const result = evaluateConnectedIntelligence(completeFixture({ artistContext: undefined }));
    expect(result.status).toBe('ACTIONS_REQUIRED');
    expect(result.actions.length).toBeGreaterThan(0);
    expect(result.actions.every(action => action.requiresHumanReview && !action.executionAuthorized)).toBe(true);
  });
});
