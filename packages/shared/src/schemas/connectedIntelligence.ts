import { z } from 'zod';
import { ArtistContextSchema } from './artistContext.js';
import {
  CanonicalMusicEntitySchema,
  EvidenceReferenceSchema,
  isAuthoritativeProvenance,
  ProvenanceSchema,
} from './musicEntity.js';
import { MusicDomainEventSchema, MusicEventEntityReferenceSchema } from './musicEvent.js';
import { MusicRelationshipSchema } from './musicRelationship.js';
import { RightsIntelligenceReportSchema } from './rightsIntelligence.js';

const IdSchema = z.string().trim().min(1).max(160);
const IsoDateTimeSchema = z.string().datetime();

/**
 * A caller-declared registration prerequisite. Provider confirmation alone is
 * deliberately not equivalent to human verification or legal authority.
 */
export const ConnectedRegistrationRequirementSchema = z.object({
  requirementId: IdSchema,
  subject: MusicEventEntityReferenceSchema,
  registrationType: z.enum(['PRO', 'MLC', 'SOUND_EXCHANGE', 'OTHER']),
  required: z.boolean(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'CONFIRMED', 'ERROR', 'UNKNOWN']),
  verification: z.enum(['UNVERIFIED', 'PROVIDER_CONFIRMED', 'HUMAN_VERIFIED', 'DISPUTED']),
  provenance: ProvenanceSchema,
  evidence: z.array(EvidenceReferenceSchema).max(100).default([]),
}).strict();
export type ConnectedRegistrationRequirement = z.infer<typeof ConnectedRegistrationRequirementSchema>;

export const PlatformTerritoryTargetSchema = z.object({
  platform: MusicEventEntityReferenceSchema.refine(ref => ref.entityType === 'platform', 'Target must reference a platform entity.'),
  territoryCode: z.string().trim().min(1).max(32),
}).strict();
export type PlatformTerritoryTarget = z.infer<typeof PlatformTerritoryTargetSchema>;

export const PlatformTerritoryReadinessSchema = z.object({
  platform: MusicEventEntityReferenceSchema.refine(ref => ref.entityType === 'platform', 'Assessment must reference a platform entity.'),
  territoryCode: z.string().trim().min(1).max(32),
  status: z.enum(['READY', 'BLOCKED', 'UNKNOWN']),
  checkedAt: IsoDateTimeSchema,
  provenance: ProvenanceSchema,
  evidence: z.array(EvidenceReferenceSchema).max(100).default([]),
}).strict();
export type PlatformTerritoryReadiness = z.infer<typeof PlatformTerritoryReadinessSchema>;

export const ConnectedIntelligenceFreshnessPolicySchema = z.object({
  rightsReportMaxAgeMs: z.number().int().positive().max(365 * 24 * 60 * 60 * 1000),
  registrationMaxAgeMs: z.number().int().positive().max(365 * 24 * 60 * 60 * 1000),
  platformReadinessMaxAgeMs: z.number().int().positive().max(365 * 24 * 60 * 60 * 1000),
}).strict();
export type ConnectedIntelligenceFreshnessPolicy = z.infer<typeof ConnectedIntelligenceFreshnessPolicySchema>;

export const ConnectedIntelligenceInputSchema = z.object({
  event: MusicDomainEventSchema,
  artistContext: ArtistContextSchema.optional(),
  entities: z.array(CanonicalMusicEntitySchema).max(10_000).default([]),
  relationships: z.array(MusicRelationshipSchema).max(50_000).default([]),
  rightsReports: z.array(RightsIntelligenceReportSchema).max(5_000).default([]),
  registrationRequirements: z.array(ConnectedRegistrationRequirementSchema).max(2_000).default([]),
  platformTerritoryTargets: z.array(PlatformTerritoryTargetSchema).max(2_000).default([]),
  platformTerritoryReadiness: z.array(PlatformTerritoryReadinessSchema).max(10_000).default([]),
  freshnessPolicy: ConnectedIntelligenceFreshnessPolicySchema,
  evaluatedAt: IsoDateTimeSchema,
}).strict();
export type ConnectedIntelligenceInput = z.input<typeof ConnectedIntelligenceInputSchema>;

export const ConnectedIntelligenceActionCodeSchema = z.enum([
  'RESOLVE_EVENT_SUBJECT',
  'CONFIRM_ARTIST_IDENTITY',
  'LINK_RELEASE_RECORDING',
  'VERIFY_MUSIC_RELATIONSHIP',
  'REVIEW_RIGHTS',
  'SPECIFY_REGISTRATION_SCOPE',
  'RESOLVE_REGISTRATION_SUBJECT',
  'COMPLETE_REGISTRATION',
  'VERIFY_REGISTRATION',
  'REVIEW_REGISTRATION',
  'SELECT_PLATFORM_TERRITORY_SCOPE',
  'LINK_PLATFORM_TO_RELEASE',
  'VERIFY_PLATFORM_TERRITORY',
  'RESOLVE_PLATFORM_TERRITORY',
]);
export type ConnectedIntelligenceActionCode = z.infer<typeof ConnectedIntelligenceActionCodeSchema>;

export const ConnectedIntelligenceActionSchema = z.object({
  actionId: z.string().trim().min(1).max(300),
  code: ConnectedIntelligenceActionCodeSchema,
  source: z.enum(['EVENT', 'ARTIST_CONTEXT', 'MUSIC_IDENTITY', 'RELATIONSHIPS', 'RIGHTS', 'REGISTRATIONS', 'TERRITORY_PLATFORM']),
  subject: MusicEventEntityReferenceSchema,
  /** Direct canonical subject input for the Phase 10 action planner; never an external identifier. */
  subjectEntityId: IdSchema,
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(1).max(1000),
  evidence: z.array(EvidenceReferenceSchema).max(100),
  requiresHumanReview: z.literal(true),
  executionAuthorized: z.literal(false),
}).strict().superRefine((action, ctx) => {
  if (action.subjectEntityId !== action.subject.entityId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subjectEntityId'], message: 'subjectEntityId must match the canonical subject reference.' });
  }
});
export type ConnectedIntelligenceAction = z.infer<typeof ConnectedIntelligenceActionSchema>;

export const ConnectedIntelligenceResultSchema = z.object({
  schemaVersion: z.literal('connected-intelligence.v1'),
  sourceEventId: IdSchema,
  status: z.enum(['ACTIONS_REQUIRED', 'NO_ACTION_REQUIRED', 'NOT_EVALUATED']),
  evaluatedDimensions: z.array(z.enum(['EVENT', 'ARTIST_CONTEXT', 'MUSIC_IDENTITY', 'RELATIONSHIPS', 'RIGHTS', 'REGISTRATIONS', 'TERRITORY_PLATFORM'])),
  actions: z.array(ConnectedIntelligenceActionSchema).max(20_000),
  explanation: z.string().trim().min(1).max(1000),
  evaluatedAt: IsoDateTimeSchema,
}).strict();
export type ConnectedIntelligenceResult = z.infer<typeof ConnectedIntelligenceResultSchema>;

const SUPPORTED_EVENT_TYPES = new Set(['release.planned']);
const EVALUATED_DIMENSIONS: ConnectedIntelligenceResult['evaluatedDimensions'] = [
  'EVENT', 'ARTIST_CONTEXT', 'MUSIC_IDENTITY', 'RELATIONSHIPS', 'RIGHTS', 'REGISTRATIONS', 'TERRITORY_PLATFORM',
];

/**
 * Deterministic Phase 9 preflight for a planned release. This consumes
 * canonical facts and subsystem snapshots; it does not create/persist facts,
 * dispatch actions, emit DDEX messages, or grant delivery/rights authority.
 * Unsupported event types are explicitly NOT_EVALUATED, never a green result.
 */
export function evaluateConnectedIntelligence(input: ConnectedIntelligenceInput): ConnectedIntelligenceResult {
  const parsed = ConnectedIntelligenceInputSchema.parse(input);
  const actions: ConnectedIntelligenceAction[] = [];
  const actionKeys = new Set<string>();
  const addAction = (
    action: Omit<ConnectedIntelligenceAction, 'actionId' | 'subjectEntityId' | 'requiresHumanReview' | 'executionAuthorized' | 'evidence'> & { evidence?: ConnectedIntelligenceAction['evidence'] },
    identityScope?: string,
  ) => {
    const identity = JSON.stringify([action.code, action.subject.entityType, action.subject.entityId, identityScope ?? null]);
    if (actionKeys.has(identity)) return;
    actionKeys.add(identity);
    actions.push(ConnectedIntelligenceActionSchema.parse({
      ...action,
      actionId: `connected_intelligence:${stableHash(JSON.stringify([parsed.event.eventId, identity]))}`,
      subjectEntityId: action.subject.entityId,
      evidence: action.evidence ?? [],
      requiresHumanReview: true,
      executionAuthorized: false,
    }));
  };

  if (!SUPPORTED_EVENT_TYPES.has(parsed.event.eventType)) {
    return ConnectedIntelligenceResultSchema.parse({
      schemaVersion: 'connected-intelligence.v1',
      sourceEventId: parsed.event.eventId,
      status: 'NOT_EVALUATED',
      evaluatedDimensions: ['EVENT'],
      actions: [],
      explanation: `No Phase 9 rule is defined for ${parsed.event.eventType}; no readiness conclusion was made.`,
      evaluatedAt: parsed.evaluatedAt,
    });
  }

  const releaseRef = parsed.event.subject;
  const entityById = new Map(parsed.entities.map(entity => [entity.id, entity]));
  const release = entityById.get(releaseRef.entityId);
  if (!release || release.entityType !== 'release') {
    addAction({
      code: 'RESOLVE_EVENT_SUBJECT', source: 'EVENT', subject: releaseRef,
      title: 'Resolve the planned release identity',
      detail: 'The event subject does not resolve to a canonical release in the supplied identity snapshot.',
    });
    return ConnectedIntelligenceResultSchema.parse({
      schemaVersion: 'connected-intelligence.v1', sourceEventId: parsed.event.eventId,
      status: 'ACTIONS_REQUIRED', evaluatedDimensions: ['EVENT', 'MUSIC_IDENTITY'], actions,
      explanation: 'The release subject is unresolved, so downstream readiness checks were not treated as complete.',
      evaluatedAt: parsed.evaluatedAt,
    });
  }

  const artistId = parsed.artistContext?.artistEntityId;
  const artist = artistId ? entityById.get(artistId) : undefined;
  const eventArtistRefs = parsed.event.relatedEntities.filter(ref => ref.entityType === 'artist');
  if (!artistId || !artist || artist.entityType !== 'artist' || !eventArtistRefs.some(ref => ref.entityId === artistId)) {
    addAction({
      code: 'CONFIRM_ARTIST_IDENTITY', source: 'ARTIST_CONTEXT', subject: releaseRef,
      title: 'Confirm the artist identity for this release',
      detail: 'Artist Context must resolve to a canonical artist explicitly associated with the release event; names or external identifiers are not used to infer identity.',
    });
  }

  const releaseMemberships = parsed.relationships.filter(relationship =>
    relationship.type === 'INCLUDED_ON' && relationship.toEntityId === releaseRef.entityId,
  );
  for (const relationship of releaseMemberships.filter(candidate =>
    candidate.status === 'DISPUTED' || candidate.provenance.state === 'DISPUTED',
  )) {
    addAction({
      code: 'VERIFY_MUSIC_RELATIONSHIP', source: 'RELATIONSHIPS', subject: releaseRef,
      title: 'Resolve a disputed release track relationship',
      detail: 'A disputed release membership remains visible even when another active link exists; human resolution is required.',
      evidence: relationship.provenance.evidence,
    }, `relationship:${relationship.id}:disputed`);
  }
  for (const relationship of releaseMemberships) {
    const sourceEntity = entityById.get(relationship.fromEntityId);
    if (!sourceEntity || sourceEntity.entityType !== 'sound_recording') {
      addAction({
        code: 'VERIFY_MUSIC_RELATIONSHIP', source: 'RELATIONSHIPS', subject: releaseRef,
        title: 'Verify the release track relationship',
        detail: 'A release membership relationship points to a missing or non-recording canonical entity.',
        evidence: relationship.provenance.evidence,
      }, `relationship:${relationship.id}:invalid-source`);
    } else if ((relationship.status !== 'ACTIVE' && relationship.status !== 'DISPUTED')
      || (!isAuthoritativeProvenance(relationship.provenance.state) && relationship.provenance.state !== 'DISPUTED')) {
      addAction({
        code: 'VERIFY_MUSIC_RELATIONSHIP', source: 'RELATIONSHIPS', subject: releaseRef,
        title: 'Verify the release track relationship',
        detail: 'This relationship is not both active and supported by authoritative provenance; verify it before treating the recording as part of the release.',
        evidence: relationship.provenance.evidence,
      }, `relationship:${relationship.id}:not-authoritative`);
    }
  }
  const activeAuthoritativeMemberships = releaseMemberships.filter(relationship =>
    relationship.status === 'ACTIVE'
      && isAuthoritativeProvenance(relationship.provenance.state)
      && entityById.get(relationship.fromEntityId)?.entityType === 'sound_recording',
  );
  if (activeAuthoritativeMemberships.length === 0) {
    if (releaseMemberships.length === 0) {
      addAction({
        code: 'LINK_RELEASE_RECORDING', source: 'RELATIONSHIPS', subject: releaseRef,
        title: 'Link a canonical recording to the release',
        detail: 'No canonical sound recording is linked to this release yet.',
      });
    }
  }

  if (artist && artist.entityType === 'artist' && activeAuthoritativeMemberships.length > 0) {
    const releaseRecordingIds = new Set(activeAuthoritativeMemberships.map(relationship => relationship.fromEntityId));
    const artistPerformances = parsed.relationships.filter(relationship =>
      relationship.type === 'PERFORMED_ON'
        && relationship.fromEntityId === artist.id
        && releaseRecordingIds.has(relationship.toEntityId),
    );
    const verifiedRecordingIds = new Set(artistPerformances.filter(relationship =>
      relationship.status === 'ACTIVE' && isAuthoritativeProvenance(relationship.provenance.state),
    ).map(relationship => relationship.toEntityId));
    if (!activeAuthoritativeMemberships.some(relationship => verifiedRecordingIds.has(relationship.fromEntityId))) {
      if (artistPerformances.length > 0) {
        for (const relationship of artistPerformances.filter(candidate =>
          candidate.status === 'DISPUTED' || candidate.provenance.state === 'DISPUTED'
            || candidate.status !== 'ACTIVE' || !isAuthoritativeProvenance(candidate.provenance.state),
        )) {
          addAction({
            code: 'VERIFY_MUSIC_RELATIONSHIP', source: 'RELATIONSHIPS', subject: { entityId: artist.id, entityType: 'artist' },
            title: 'Verify the artist recording credit',
            detail: 'This artist credit is not both active and supported by authoritative provenance for a recording on this release.',
            evidence: relationship.provenance.evidence,
          }, `relationship:${relationship.id}:artist-performance`);
        }
      } else {
        addAction({
          code: 'CONFIRM_ARTIST_IDENTITY', source: 'RELATIONSHIPS', subject: { entityId: artist.id, entityType: 'artist' },
          title: 'Confirm the artist recording credit',
          detail: 'The artist must have an active, authoritatively sourced performance relationship to at least one recording on this release.',
        });
      }
    }
  }

  for (const membership of activeAuthoritativeMemberships) {
    const recordingId = membership.fromEntityId;
    const candidateReports = parsed.rightsReports
      .filter(candidate => candidate.targetEntityId === recordingId)
      .sort((left, right) => Date.parse(right.evaluatedAt) - Date.parse(left.evaluatedAt));
    const report = candidateReports[0];
    const fresh = report && isFresh(report.evaluatedAt, parsed.evaluatedAt, parsed.freshnessPolicy.rightsReportMaxAgeMs);
    const hasHumanReviewFinding = report?.findings.some(finding =>
      finding.requiresHumanReview || finding.severity === 'BLOCKING',
    ) ?? false;
    const sameTimeConflict = report && candidateReports.some(candidate =>
      candidate.evaluatedAt === report.evaluatedAt
        && (candidate.releaseReviewRequired !== report.releaseReviewRequired
          || candidate.findings.some(finding => finding.requiresHumanReview || finding.severity === 'BLOCKING') !== hasHumanReviewFinding),
    );
    if (!report || !fresh || report.releaseReviewRequired || hasHumanReviewFinding || sameTimeConflict) {
      addAction({
        code: 'REVIEW_RIGHTS', source: 'RIGHTS', subject: { entityId: recordingId, entityType: 'sound_recording' },
        title: 'Review current rights readiness',
        detail: !report
          ? 'No rights preflight report was supplied for this recording.'
          : !fresh
            ? 'The rights preflight report is stale under the supplied freshness policy.'
            : sameTimeConflict
              ? 'Conflicting rights reports were supplied for the same evaluation time; human review is required.'
              : 'Rights preflight findings require review; no rights were inferred or cleared by this evaluator.',
      });
    }
  }

  if (parsed.registrationRequirements.length === 0) {
    addAction({
      code: 'SPECIFY_REGISTRATION_SCOPE', source: 'REGISTRATIONS', subject: releaseRef,
      title: 'Specify applicable registration checks',
      detail: 'No registration requirements were supplied; the evaluator cannot claim registration readiness without an explicit scope.',
    });
  }
  for (const registration of parsed.registrationRequirements.filter(requirement => requirement.required)) {
    const subjectEntity = entityById.get(registration.subject.entityId);
    if (!subjectEntity || subjectEntity.entityType !== registration.subject.entityType) {
      addAction({
        code: 'RESOLVE_REGISTRATION_SUBJECT', source: 'REGISTRATIONS', subject: registration.subject,
        title: 'Resolve the registration subject',
        detail: 'The registration requirement does not resolve to the supplied canonical entity snapshot.',
        evidence: registration.evidence,
      }, `requirement:${registration.requirementId}`);
      continue;
    }
    if (registration.verification === 'DISPUTED' || registration.provenance.state === 'DISPUTED') {
      addAction({
        code: 'REVIEW_REGISTRATION', source: 'REGISTRATIONS', subject: registration.subject,
        title: 'Resolve the disputed registration state',
        detail: 'Conflicting registration information is preserved for human resolution.',
        evidence: registration.evidence,
      }, `requirement:${registration.requirementId}`);
      continue;
    }
    const fresh = isFresh(registration.provenance.observedAt, parsed.evaluatedAt, parsed.freshnessPolicy.registrationMaxAgeMs);
    const humanVerified = registration.status === 'CONFIRMED'
      && registration.verification === 'HUMAN_VERIFIED'
      && registration.provenance.state === 'USER_CONFIRMED'
      && registration.evidence.length > 0
      && fresh;
    if (humanVerified) continue;
    const code = registration.status === 'NOT_STARTED'
      ? 'COMPLETE_REGISTRATION'
      : registration.status === 'ERROR' || registration.status === 'UNKNOWN'
        ? 'REVIEW_REGISTRATION'
        : 'VERIFY_REGISTRATION';
    const requirementDescription = `${registration.registrationType} registration requirement ${registration.requirementId}`;
    addAction({
      code, source: 'REGISTRATIONS', subject: registration.subject,
      title: code === 'COMPLETE_REGISTRATION' ? `Complete the ${registration.registrationType} registration` : code === 'REVIEW_REGISTRATION' ? `Review the ${registration.registrationType} registration status` : `Verify the ${registration.registrationType} registration status`,
      detail: `${requirementDescription}: ${!fresh
        ? 'The registration observation is stale; refresh it and preserve the source evidence before treating it as complete.'
        : registration.status === 'CONFIRMED' && registration.verification === 'PROVIDER_CONFIRMED'
          ? 'Provider confirmation is recorded separately from human verification; the confirmation does not establish rights ownership.'
          : registration.status === 'SUBMITTED' || registration.status === 'IN_PROGRESS'
            ? 'A submission or in-progress status is not a verified registration; check the provider and retain its evidence.'
            : registration.status === 'NOT_STARTED'
            ? 'The caller marked this required registration as not started; user authorization and any required legal checkpoint remain mandatory.'
              : 'The supplied registration state is not sufficiently verified for readiness.'}`,
      evidence: registration.evidence,
    }, `requirement:${registration.requirementId}`);
  }

  if (parsed.platformTerritoryTargets.length === 0) {
    addAction({
      code: 'SELECT_PLATFORM_TERRITORY_SCOPE', source: 'TERRITORY_PLATFORM', subject: releaseRef,
      title: 'Select distribution platforms and territories',
      detail: 'No explicit platform/territory scope was supplied, so distribution readiness cannot be reported as complete.',
    });
  }
  for (const target of parsed.platformTerritoryTargets) {
    if (!parsed.event.relatedEntities.some(reference => reference.entityType === 'platform' && reference.entityId === target.platform.entityId)) {
      addAction({
        code: 'LINK_PLATFORM_TO_RELEASE', source: 'TERRITORY_PLATFORM', subject: target.platform,
        title: 'Confirm the platform target for this release',
        detail: 'The explicit platform target is not linked to the planned release event; confirm the scope before readiness evaluation.',
      }, `platform:${target.platform.entityId}`);
    }
    const territoryScope = `platform:${target.platform.entityId}:territory:${target.territoryCode.trim().toUpperCase()}`;
    const readiness = parsed.platformTerritoryReadiness.find(assessment =>
      assessment.platform.entityId === target.platform.entityId
        && assessment.territoryCode.toUpperCase() === target.territoryCode.toUpperCase(),
    );
    if (!readiness || !isFresh(readiness.checkedAt, parsed.evaluatedAt, parsed.freshnessPolicy.platformReadinessMaxAgeMs)) {
      addAction({
        code: 'VERIFY_PLATFORM_TERRITORY', source: 'TERRITORY_PLATFORM', subject: target.platform,
        title: 'Verify platform readiness for the target territory',
        detail: !readiness
          ? `No platform readiness evidence was supplied for ${target.territoryCode}.`
          : `Platform readiness evidence for ${target.territoryCode} is stale under the supplied freshness policy.`,
        evidence: readiness?.evidence,
      }, territoryScope);
      continue;
    }
    const authoritative = isAuthoritativeProvenance(readiness.provenance.state) && readiness.evidence.length > 0;
    if (!authoritative || readiness.status === 'UNKNOWN') {
      addAction({
        code: 'VERIFY_PLATFORM_TERRITORY', source: 'TERRITORY_PLATFORM', subject: target.platform,
        title: 'Verify platform readiness for the target territory',
        detail: 'A ready status requires fresh evidence and authoritative provenance; detected or inferred availability is not enough.',
        evidence: readiness.evidence,
      }, territoryScope);
    } else if (readiness.status === 'BLOCKED') {
      addAction({
        code: 'RESOLVE_PLATFORM_TERRITORY', source: 'TERRITORY_PLATFORM', subject: target.platform,
        title: 'Resolve the platform territory blocker',
        detail: `Verified platform readiness is blocked for ${target.territoryCode}.`,
        evidence: readiness.evidence,
      }, territoryScope);
    }
  }

  return ConnectedIntelligenceResultSchema.parse({
    schemaVersion: 'connected-intelligence.v1',
    sourceEventId: parsed.event.eventId,
    status: actions.length ? 'ACTIONS_REQUIRED' : 'NO_ACTION_REQUIRED',
    evaluatedDimensions: EVALUATED_DIMENSIONS,
    actions,
    explanation: actions.length
      ? `${actions.length} advisory action${actions.length === 1 ? '' : 's'} require review; no external or authoritative action was taken.`
      : 'All supplied Phase 9 readiness dimensions passed their deterministic checks; no action is required for this evaluation.',
    evaluatedAt: parsed.evaluatedAt,
  });
}

function isFresh(observedAt: string, evaluatedAt: string, maxAgeMs: number): boolean {
  const ageMs = Date.parse(evaluatedAt) - Date.parse(observedAt);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= maxAgeMs;
}

/** Compact deterministic identity for action IDs; full scope stays in the dedupe key. */
function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    first = Math.imul(first ^ codeUnit, 0x01000193);
    second = Math.imul(second ^ codeUnit, 0x85ebca6b);
    second ^= second >>> 13;
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}
