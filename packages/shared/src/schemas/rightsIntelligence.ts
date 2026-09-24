import { z } from 'zod';
import { EvidenceReferenceSchema, ProvenanceSchema, RightsClaimTypeSchema } from './musicEntity.js';

const Id = z.string().trim().min(1).max(200);
const IsoDateTime = z.string().datetime();

export const RightsTruthStateSchema = z.enum([
  'KNOWN', 'DECLARED', 'DETECTED', 'DOCUMENTED', 'VERIFIED',
  'UNKNOWN', 'DISPUTED', 'UNRESOLVED',
]);
export type RightsTruthState = z.infer<typeof RightsTruthStateSchema>;

export const RightsInterestSchema = z.object({
  interestId: Id,
  targetEntityId: Id,
  partyEntityId: Id,
  interestType: z.enum(['MASTER_OWNER', 'WRITER', 'COMPOSER', 'PUBLISHER', 'ADMINISTRATOR']),
  sharePercentage: z.number().min(0).max(100).optional(),
  territoryCodes: z.array(z.string().trim().min(1).max(32)).max(300).default([]),
  state: RightsTruthStateSchema,
  provenance: ProvenanceSchema,
}).strict();
export type RightsInterest = z.infer<typeof RightsInterestSchema>;

export const ThirdPartyUseSchema = z.object({
  useId: Id,
  targetRecordingEntityId: Id,
  useType: z.enum(['SAMPLE', 'COVER', 'INTERPOLATION']),
  sourceEntityId: Id.optional(),
  description: z.string().trim().min(1).max(2000),
  state: RightsTruthStateSchema,
  exclusiveRightsConfirmed: z.boolean().default(false),
  provenance: ProvenanceSchema,
  evidence: z.array(EvidenceReferenceSchema).max(100).default([]),
}).strict();
export type ThirdPartyUse = z.infer<typeof ThirdPartyUseSchema>;

export const RightsGrantSchema = z.object({
  grantId: Id,
  subjectEntityId: Id,
  grantorEntityId: Id,
  granteeEntityId: Id,
  rights: z.array(RightsClaimTypeSchema).min(1).max(20),
  territoryCodes: z.array(z.string().trim().min(1).max(32)).max(300).default([]),
  exclusive: z.boolean(),
  validFrom: z.string().date().optional(),
  validThrough: z.string().date().optional(),
  state: RightsTruthStateSchema,
  provenance: ProvenanceSchema,
  evidence: z.array(EvidenceReferenceSchema).max(100).default([]),
}).strict().superRefine((grant, ctx) => {
  if (grant.validFrom && grant.validThrough && grant.validThrough < grant.validFrom) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validThrough'], message: 'validThrough cannot precede validFrom.' });
  }
});
export type RightsGrant = z.infer<typeof RightsGrantSchema>;

export const RightsEvidenceVaultSchema = z.object({
  entityId: Id,
  evidence: z.array(EvidenceReferenceSchema).max(1000).default([]),
}).strict();
export type RightsEvidenceVault = z.infer<typeof RightsEvidenceVaultSchema>;

export const RightsIntelligenceInputSchema = z.object({
  targetEntityId: Id,
  interests: z.array(RightsInterestSchema).max(1000).default([]),
  thirdPartyUses: z.array(ThirdPartyUseSchema).max(1000).default([]),
  grants: z.array(RightsGrantSchema).max(1000).default([]),
  evidenceVaults: z.array(RightsEvidenceVaultSchema).max(1000).default([]),
}).strict();
export type RightsIntelligenceInput = z.infer<typeof RightsIntelligenceInputSchema>;

export const RightsFindingSchema = z.object({
  code: z.enum([
    'MASTER_OWNERSHIP_UNKNOWN', 'MASTER_SPLITS_INVALID', 'COMPOSITION_OWNERSHIP_UNKNOWN',
    'COMPOSITION_SPLITS_INVALID', 'PUBLISHER_SPLITS_INVALID', 'THIRD_PARTY_USE_UNRESOLVED', 'EXCLUSIVE_RIGHTS_UNCONFIRMED',
    'GRANT_UNRESOLVED', 'EVIDENCE_MISSING', 'RIGHTS_INTEREST_UNRESOLVED', 'CATALOG_IMPORT_UNRESOLVED',
  ]),
  severity: z.enum(['INFO', 'REVIEW', 'BLOCKING']),
  entityId: Id,
  message: z.string().trim().min(1).max(2000),
  requiresHumanReview: z.boolean(),
}).strict();
export type RightsFinding = z.infer<typeof RightsFindingSchema>;

export const RightsIntelligenceReportSchema = z.object({
  schemaVersion: z.literal('rights-intelligence.v1'),
  targetEntityId: Id,
  masterShareTotal: z.number().min(0),
  compositionShareTotal: z.number().min(0),
  publisherShareTotal: z.number().min(0),
  findings: z.array(RightsFindingSchema).max(5000),
  releaseReviewRequired: z.boolean(),
  contentIdAutomaticSubmissionEligible: z.boolean(),
  evaluatedAt: IsoDateTime,
}).strict();
export type RightsIntelligenceReport = z.infer<typeof RightsIntelligenceReportSchema>;

function isAuthoritativeAssertion(
  state: RightsTruthState,
  provenance: z.infer<typeof ProvenanceSchema>,
  hasEvidence: boolean,
): boolean {
  if (!hasEvidence) return false;
  return (state === 'DOCUMENTED' && provenance.state === 'DOCUMENTED' && provenance.sourceType === 'DOCUMENT')
    || (state === 'VERIFIED' && provenance.state === 'EXTERNAL_VERIFIED' && provenance.sourceType === 'EXTERNAL_SERVICE');
}

/** Deterministic preflight. It reports gaps and never upgrades truth or executes a filing. */
export function evaluateRightsIntelligence(input: RightsIntelligenceInput, evaluatedAt: string): RightsIntelligenceReport {
  const parsed = RightsIntelligenceInputSchema.parse(input);
  const findings: RightsFinding[] = [];
  const master = parsed.interests.filter((interest) => interest.interestType === 'MASTER_OWNER');
  const composition = parsed.interests.filter((interest) => ['WRITER', 'COMPOSER'].includes(interest.interestType));
  const publishers = parsed.interests.filter((interest) => interest.interestType === 'PUBLISHER');
  const sum = (interests: RightsInterest[]) => interests.reduce((total, interest) => total + (interest.sharePercentage ?? 0), 0);
  const masterShareTotal = sum(master);
  const compositionShareTotal = sum(composition);
  const publisherShareTotal = sum(publishers);

  if (master.length === 0) findings.push({ code: 'MASTER_OWNERSHIP_UNKNOWN', severity: 'BLOCKING', entityId: parsed.targetEntityId, message: 'Master ownership has not been declared or documented.', requiresHumanReview: true });
  else if (Math.abs(masterShareTotal - 100) > 0.01) findings.push({ code: 'MASTER_SPLITS_INVALID', severity: 'BLOCKING', entityId: parsed.targetEntityId, message: `Master ownership totals ${masterShareTotal}%; review is required before authoritative use.`, requiresHumanReview: true });

  if (composition.length === 0) findings.push({ code: 'COMPOSITION_OWNERSHIP_UNKNOWN', severity: 'REVIEW', entityId: parsed.targetEntityId, message: 'Composition ownership and writers are unknown.', requiresHumanReview: true });
  else if (Math.abs(compositionShareTotal - 100) > 0.01) findings.push({ code: 'COMPOSITION_SPLITS_INVALID', severity: 'BLOCKING', entityId: parsed.targetEntityId, message: `Composition interests total ${compositionShareTotal}%; review is required.`, requiresHumanReview: true });
  if (publishers.length > 0 && Math.abs(publisherShareTotal - 100) > 0.01) findings.push({ code: 'PUBLISHER_SPLITS_INVALID', severity: 'BLOCKING', entityId: parsed.targetEntityId, message: `Publisher interests total ${publisherShareTotal}%; review is required.`, requiresHumanReview: true });

  const vaultEntities = new Set(parsed.evidenceVaults.filter((vault) => vault.evidence.length > 0).map((vault) => vault.entityId));
  for (const rightsInterest of [...master, ...composition, ...publishers]) {
    const hasEvidence = rightsInterest.provenance.evidence.length > 0
      || vaultEntities.has(rightsInterest.targetEntityId)
      || vaultEntities.has(rightsInterest.partyEntityId);
    const authoritative = isAuthoritativeAssertion(rightsInterest.state, rightsInterest.provenance, hasEvidence);
    if (!authoritative) {
      const disputed = rightsInterest.state === 'DISPUTED' || rightsInterest.state === 'UNRESOLVED'
        || rightsInterest.provenance.state === 'DISPUTED';
      findings.push({
        code: 'RIGHTS_INTEREST_UNRESOLVED',
        severity: disputed ? 'BLOCKING' : 'REVIEW',
        entityId: rightsInterest.targetEntityId,
        message: `${rightsInterest.interestType.toLowerCase().replace('_', ' ')} interest ${rightsInterest.interestId} is ${rightsInterest.state.toLowerCase()}; non-authoritative rights cannot be treated as cleared.`,
        requiresHumanReview: true,
      });
    }
    if ((rightsInterest.state === 'DOCUMENTED' || rightsInterest.state === 'VERIFIED') && !hasEvidence) {
      findings.push({ code: 'EVIDENCE_MISSING', severity: 'REVIEW', entityId: rightsInterest.targetEntityId, message: `No evidence supports documented interest ${rightsInterest.interestId}.`, requiresHumanReview: true });
    }
  }

  for (const use of parsed.thirdPartyUses) {
    const authoritative = isAuthoritativeAssertion(use.state, use.provenance, use.evidence.length > 0 || use.provenance.evidence.length > 0);
    if (!authoritative) findings.push({ code: 'THIRD_PARTY_USE_UNRESOLVED', severity: 'BLOCKING', entityId: use.targetRecordingEntityId, message: `${use.useType.toLowerCase()} rights are ${use.state.toLowerCase()} or lack matching documented provenance and evidence.`, requiresHumanReview: true });
    if (!use.exclusiveRightsConfirmed) findings.push({ code: 'EXCLUSIVE_RIGHTS_UNCONFIRMED', severity: 'BLOCKING', entityId: use.targetRecordingEntityId, message: `${use.useType.toLowerCase()} material prevents automatic Content ID submission until exclusive-rights eligibility is reviewed.`, requiresHumanReview: true });
    if (use.evidence.length === 0) findings.push({ code: 'EVIDENCE_MISSING', severity: 'REVIEW', entityId: use.targetRecordingEntityId, message: `No evidence is attached to the ${use.useType.toLowerCase()} record.`, requiresHumanReview: true });
  }
  for (const grant of parsed.grants) {
    if (!isAuthoritativeAssertion(grant.state, grant.provenance, grant.evidence.length > 0 || grant.provenance.evidence.length > 0)) {
      findings.push({ code: 'GRANT_UNRESOLVED', severity: 'BLOCKING', entityId: grant.subjectEntityId, message: `Rights grant ${grant.grantId} is ${grant.state.toLowerCase()} or lacks matching documented provenance and evidence.`, requiresHumanReview: true });
    }
  }

  const allCoreInterestsAuthoritative = [...master, ...composition, ...publishers].every((interest) => isAuthoritativeAssertion(
    interest.state,
    interest.provenance,
    interest.provenance.evidence.length > 0 || vaultEntities.has(interest.targetEntityId) || vaultEntities.has(interest.partyEntityId),
  ));
  const releaseReviewRequired = findings.some((finding) => finding.requiresHumanReview);
  return RightsIntelligenceReportSchema.parse({
    schemaVersion: 'rights-intelligence.v1', targetEntityId: parsed.targetEntityId,
    masterShareTotal, compositionShareTotal, publisherShareTotal, findings, releaseReviewRequired,
    contentIdAutomaticSubmissionEligible: !releaseReviewRequired
      && parsed.thirdPartyUses.length === 0
      && allCoreInterestsAuthoritative,
    evaluatedAt,
  });
}
