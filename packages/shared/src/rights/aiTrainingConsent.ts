import { z } from 'zod';
import { RightsEntityId, RightsId, Sha256 } from './contracts.js';

/**
 * Permitted specific scopes of AI model training.
 * Training permissions are never blanket; each grant binds strictly to explicit model domains.
 */
export const AITrainingScopeSchema = z.enum([
  'voice_timbre_model',
  'stem_separation_model',
  'music_foundation_model',
  'lyrics_language_model',
  'visual_diffusion_model',
]);
export type AITrainingScope = z.infer<typeof AITrainingScopeSchema>;

export const AITrainingAssetTypeSchema = z.enum([
  'master_recording',
  'stem',
  'composition_lyrics',
  'composition_midi',
  'artwork',
  'curated_metadata',
]);
export type AITrainingAssetType = z.infer<typeof AITrainingAssetTypeSchema>;

/**
 * Verified contractual compensation structure for AI training grants.
 * Both the rightsholder(s) and indii.music must receive contractual compensation.
 */
const EvidenceTimestamp = z.number().int().positive().safe();

export const AITrainingCompensationSchema = z.object({
  artistCents: z.number().int().positive(),
  platformCents: z.number().int().positive(),
  currency: z.literal('USD'),
  termsAgreementHash: Sha256,
  paidAt: EvidenceTimestamp.nullable(),
  payoutTransactionId: z.string().trim().min(1).max(200).nullable(),
}).strict();
export type AITrainingCompensation = z.infer<typeof AITrainingCompensationSchema>;

/**
 * Canonical AI Training Permission Grant.
 * Represents an explicit, affirmative, un-inferred right granted by a single rightsholder.
 */
export const AITrainingGrantSchema = z.object({
  grantId: RightsId,
  assetId: RightsId,
  assetType: AITrainingAssetTypeSchema,
  rightsholderEntityId: RightsEntityId,
  affirmativeOptIn: z.literal(true),
  optInTimestamp: EvidenceTimestamp,
  expiresAt: EvidenceTimestamp,
  revokedAt: EvidenceTimestamp.nullable(),
  authorizedVendor: z.string().trim().min(1).max(200),
  scopes: z.array(AITrainingScopeSchema).min(1).max(10),
  compensation: AITrainingCompensationSchema,
  auditLogId: z.string().trim().min(1).max(200),
}).strict();
export type AITrainingGrant = z.infer<typeof AITrainingGrantSchema>;

const AITrainingExportRequestSchema = z.object({
  assetId: RightsId,
  assetType: AITrainingAssetTypeSchema,
  requiredRightsholderEntityIds: z.array(RightsEntityId),
  grants: z.array(AITrainingGrantSchema),
  requestedVendor: z.string().trim().min(1).max(200),
  requestedScope: AITrainingScopeSchema,
  currentTime: EvidenceTimestamp.optional(),
}).strict();

export interface AITrainingExportEvaluation {
  allowed: boolean;
  reason?: string;
  unconsentedRightsholders?: string[];
  evaluationTimestamp: number;
}

/**
 * Deterministically evaluates whether an asset may be exported for AI training.
 *
 * Rules:
 * 1. Default NO AI training: empty or missing grants unconditionally deny.
 * 2. Non-inference: permissions cannot be inferred from distribution, processing, or upload.
 * 3. Complete rightsholder consensus: every single required rightsholder must have an active grant.
 * 4. Consent must already be effective; recorded revocation or expiry denies.
 * 5. Scope and Vendor match: the grant must explicitly authorize the requested vendor and scope.
 * 6. Settled compensation: compensation must be positive, agreed, and paid no later than evaluation.
 * 7. Request and grant evidence must pass runtime schema validation.
 */
export function evaluateAITrainingExport(params: {
  assetId: string;
  assetType: AITrainingAssetType;
  requiredRightsholderEntityIds: string[];
  grants: AITrainingGrant[];
  requestedVendor: string;
  requestedScope: AITrainingScope;
  currentTime?: number;
}): AITrainingExportEvaluation {
  // TypeScript types do not validate stored data or JavaScript callers. Parse
  // here so malformed evidence cannot skip temporal or monetary comparisons.
  const parsed = AITrainingExportRequestSchema.safeParse(params);
  if (!parsed.success) {
    return {
      allowed: false,
      reason: 'Denied: Invalid AI training export request or grant evidence.',
      evaluationTimestamp: Date.now(),
    };
  }
  const input = parsed.data;
  const now = input.currentTime ?? Date.now();

  if (!input.requiredRightsholderEntityIds || input.requiredRightsholderEntityIds.length === 0) {
    return {
      allowed: false,
      reason: 'Denied: Assets with unverified or empty rightsholders cannot be authorized for AI training.',
      evaluationTimestamp: now,
    };
  }

  if (!input.grants || input.grants.length === 0) {
    return {
      allowed: false,
      reason: 'Denied by default: No affirmative AI training grants exist for this asset.',
      unconsentedRightsholders: [...input.requiredRightsholderEntityIds],
      evaluationTimestamp: now,
    };
  }

  // Validate that all required rightsholders have valid, active, matching grants
  const unconsented: string[] = [];

  for (const requiredId of input.requiredRightsholderEntityIds) {
    const grant = input.grants.find(
      (g) => g.rightsholderEntityId === requiredId && g.assetId === input.assetId && g.assetType === input.assetType
    );

    if (!grant) {
      unconsented.push(requiredId);
      continue;
    }

    if (grant.affirmativeOptIn !== true) {
      unconsented.push(requiredId);
      continue;
    }

    if (grant.optInTimestamp > now) {
      return {
        allowed: false,
        reason: `Denied: AI training grant ${grant.grantId} has not taken effect.`,
        evaluationTimestamp: now,
      };
    }

    // A recorded revocation is not active permission, including inconsistent
    // future-dated revocation evidence. Resolve it before considering export.
    if (grant.revokedAt !== null) {
      return {
        allowed: false,
        reason: `Denied: AI training grant ${grant.grantId} for rightsholder ${requiredId} was revoked.`,
        evaluationTimestamp: now,
      };
    }

    if (grant.expiresAt <= now) {
      return {
        allowed: false,
        reason: `Denied: AI training grant ${grant.grantId} for rightsholder ${requiredId} has expired.`,
        evaluationTimestamp: now,
      };
    }

    if (grant.authorizedVendor !== input.requestedVendor) {
      return {
        allowed: false,
        reason: `Denied: AI training grant authorizes vendor "${grant.authorizedVendor}", but "${input.requestedVendor}" was requested.`,
        evaluationTimestamp: now,
      };
    }

    if (!grant.scopes.includes(input.requestedScope)) {
      return {
        allowed: false,
        reason: `Denied: AI training grant does not authorize scope "${input.requestedScope}".`,
        evaluationTimestamp: now,
      };
    }

    if (!grant.compensation.paidAt || grant.compensation.paidAt > now || !grant.compensation.payoutTransactionId) {
      return {
        allowed: false,
        reason: `Denied: AI training compensation for grant ${grant.grantId} is not settled/paid.`,
        evaluationTimestamp: now,
      };
    }

    if (grant.compensation.artistCents <= 0 || grant.compensation.platformCents <= 0) {
      return {
        allowed: false,
        reason: `Denied: AI training compensation must provide positive contractual payment to rightsholder and platform.`,
        evaluationTimestamp: now,
      };
    }
  }

  if (unconsented.length > 0) {
    return {
      allowed: false,
      reason: `Denied: ${unconsented.length} required rightsholder(s) have not affirmatively opted in to AI training.`,
      unconsentedRightsholders: unconsented,
      evaluationTimestamp: now,
    };
  }

  return {
    allowed: true,
    evaluationTimestamp: now,
  };
}
