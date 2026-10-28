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
export const AITrainingCompensationSchema = z.object({
  artistCents: z.number().int().positive(),
  platformCents: z.number().int().positive(),
  currency: z.literal('USD'),
  termsAgreementHash: Sha256,
  paidAt: z.number().int().positive().nullable(),
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
  optInTimestamp: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  revokedAt: z.number().int().positive().nullable(),
  authorizedVendor: z.string().trim().min(1).max(200),
  scopes: z.array(AITrainingScopeSchema).min(1).max(10),
  compensation: AITrainingCompensationSchema,
  auditLogId: z.string().trim().min(1).max(200),
}).strict();
export type AITrainingGrant = z.infer<typeof AITrainingGrantSchema>;

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
 * 4. Revocation and expiration: any revoked grant or expired grant immediately fails.
 * 5. Scope and Vendor match: the grant must explicitly authorize the requested vendor and scope.
 * 6. Settled compensation: compensation must be positive, agreed, and paid (settled) before export.
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
  const now = params.currentTime ?? Date.now();

  if (!params.requiredRightsholderEntityIds || params.requiredRightsholderEntityIds.length === 0) {
    return {
      allowed: false,
      reason: 'Denied: Assets with unverified or empty rightsholders cannot be authorized for AI training.',
      evaluationTimestamp: now,
    };
  }

  if (!params.grants || params.grants.length === 0) {
    return {
      allowed: false,
      reason: 'Denied by default: No affirmative AI training grants exist for this asset.',
      unconsentedRightsholders: [...params.requiredRightsholderEntityIds],
      evaluationTimestamp: now,
    };
  }

  // Validate that all required rightsholders have valid, active, matching grants
  const unconsented: string[] = [];

  for (const requiredId of params.requiredRightsholderEntityIds) {
    const grant = params.grants.find(
      (g) => g.rightsholderEntityId === requiredId && g.assetId === params.assetId
    );

    if (!grant) {
      unconsented.push(requiredId);
      continue;
    }

    if (grant.affirmativeOptIn !== true) {
      unconsented.push(requiredId);
      continue;
    }

    if (grant.revokedAt !== null && grant.revokedAt <= now) {
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

    if (grant.authorizedVendor !== params.requestedVendor) {
      return {
        allowed: false,
        reason: `Denied: AI training grant authorizes vendor "${grant.authorizedVendor}", but "${params.requestedVendor}" was requested.`,
        evaluationTimestamp: now,
      };
    }

    if (!grant.scopes.includes(params.requestedScope)) {
      return {
        allowed: false,
        reason: `Denied: AI training grant does not authorize scope "${params.requestedScope}".`,
        evaluationTimestamp: now,
      };
    }

    if (!grant.compensation.paidAt || !grant.compensation.payoutTransactionId) {
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
