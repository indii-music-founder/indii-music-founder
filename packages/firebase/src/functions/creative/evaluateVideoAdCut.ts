import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { FUNCTION_INTELLIGENCE_MODELS } from '../../config/models';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { getVertexAIClient } from '../../lib/vertexClient';
import { arcjetKey } from '../../config/secrets';
import { protectAuthenticatedApiRequest, policyClassForServerEntitlement } from '../security/arcjet';
import { entitlementTierToBudgetTier, requireVerifiedServerEntitlement } from '../auth/entitlements';
import {
  checkOperationBudget,
  finalizeOperationReservation,
  requireVerifiedCreativeUser,
} from '../billing/enforceOperationCost';

export const VIDEO_AD_PASS_THRESHOLD = 9.0;
export const VIDEO_AD_EVALUATION_RESERVATION_USD = 0.04;

const ALLOWED_KEYFRAME_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const requestSchema = z.object({
  variantId: z.string().trim().min(1).max(128),
  shape: z.enum(['9:16', '1:1', '4:5', '16:9']),
  durationSeconds: z.number().finite().positive().max(120),
  briefSummary: z.string().trim().min(1).max(1500),
  keyframeBase64List: z.array(
    z.string().min(4).max(4_000_000).refine((raw) => {
      const payload = stripBase64Prefix(raw).trim();
      return payload.length >= 4 && /^[A-Za-z0-9+/]+={0,2}$/.test(payload);
    }, 'Keyframe must contain a non-empty base64 image payload.'),
  ).min(1).max(4),
  mimeType: z.string().default('image/jpeg').refine(
    (value) => ALLOWED_KEYFRAME_MIME_TYPES.has(value.toLowerCase()),
    'Unsupported keyframe mimeType.',
  ),
}).strict();

const refinementPatchSchema = z.object({
  fontScaleMultiplier: z.number().finite().optional(),
  extraSafeMarginPct: z.number().finite().optional(),
  headlineOverride: z.string().max(160).optional(),
  ctaOverride: z.string().max(80).optional(),
}).passthrough();

const rawScoreSchema = z.object({
  firstTwoSecondHook: z.number().finite(),
  mobileLegibility: z.number().finite(),
  safeZoneIntegrity: z.number().finite(),
  audioVisualPacing: z.number().finite(),
  brandAlignment: z.number().finite(),
  overallScore: z.number().finite(),
  overallPass: z.boolean(),
  gapsFound: z.string().max(500).default('None'),
  refinementPatch: refinementPatchSchema.optional(),
}).passthrough();

export interface EvaluateVideoAdCutInput {
  model: string;
  prompt: string;
  keyframes: Array<{ mimeType: string; data: string }>;
}

export interface VideoAdCutEvaluationResponse {
  variantId: string;
  shape: '9:16' | '1:1' | '4:5' | '16:9';
  durationSeconds: number;
  model: string;
  firstTwoSecondHook: number;
  mobileLegibility: number;
  safeZoneIntegrity: number;
  audioVisualPacing: number;
  brandAlignment: number;
  overallScore: number;
  overallPass: boolean;
  gapsFound: string;
  refinementPatch?: {
    fontScaleMultiplier?: number;
    extraSafeMarginPct?: number;
    headlineOverride?: string;
    ctaOverride?: string;
  };
}

function clampScore(value: number): number {
  return Math.round(Math.max(0, Math.min(10, value)) * 10) / 10;
}

function stripBase64Prefix(frame: string): string {
  const marker = 'base64,';
  const index = frame.indexOf(marker);
  return index >= 0 ? frame.slice(index + marker.length) : frame;
}

function sanitizeRefinementPatch(
  rawPatch: z.infer<typeof refinementPatchSchema> | undefined,
): VideoAdCutEvaluationResponse['refinementPatch'] | undefined {
  if (!rawPatch) return undefined;
  const patch: NonNullable<VideoAdCutEvaluationResponse['refinementPatch']> = {};
  if (typeof rawPatch.fontScaleMultiplier === 'number') {
    patch.fontScaleMultiplier = Math.round(
      Math.max(0.75, Math.min(1.25, rawPatch.fontScaleMultiplier)) * 100,
    ) / 100;
  }
  if (typeof rawPatch.extraSafeMarginPct === 'number') {
    patch.extraSafeMarginPct = Math.round(
      Math.max(0, Math.min(0.1, rawPatch.extraSafeMarginPct)) * 1000,
    ) / 1000;
  }
  if (rawPatch.headlineOverride && rawPatch.headlineOverride.trim()) {
    patch.headlineOverride = rawPatch.headlineOverride.trim().slice(0, 160);
  }
  if (rawPatch.ctaOverride && rawPatch.ctaOverride.trim()) {
    patch.ctaOverride = rawPatch.ctaOverride.trim().slice(0, 80);
  }
  return Object.keys(patch).length > 0 ? patch : undefined;
}

/**
 * Evaluate a rendered video ad cut's keyframes against the Level 5 multimodal
 * rubric using Gemini 4 Neon (`FUNCTION_INTELLIGENCE_MODELS.TEXT.PRO`).
 */
export async function evaluateVideoAdCutRequest(
  request: CallableRequest<unknown>,
  dependencies: {
    evaluate: (input: EvaluateVideoAdCutInput) => Promise<string>;
  } = {
    evaluate: async ({ model, prompt, keyframes }) => {
      const client = getVertexAIClient();
      const parts = [
        { text: prompt },
        ...keyframes.map((frame) => ({ inlineData: { mimeType: frame.mimeType, data: frame.data } })),
      ];
      const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: 'application/json',
          temperature: 1.0,
          maxOutputTokens: 1024,
        },
      });
      return response.text ?? '';
    },
  },
): Promise<VideoAdCutEvaluationResponse> {
  validateAppCheckV2(request);
  const userId = requireVerifiedCreativeUser(request.auth);
  const entitlement = await requireVerifiedServerEntitlement(userId);
  const protection = await protectAuthenticatedApiRequest(request.rawRequest, {
    userId,
    policy: policyClassForServerEntitlement({
      tier: entitlement.tier,
      isAdmin: request.auth?.token.admin === true,
    }),
    operationId: `video-ad-eval:${userId}:${randomUUID()}`,
  });
  if (!protection.allowed) {
    const code = protection.status === 429 ? 'resource-exhausted' : 'permission-denied';
    throw new HttpsError(code, protection.message);
  }

  const parsed = requestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      'invalid-argument',
      'A valid video ad variant payload with at least one keyframe is required.',
    );
  }

  const model = FUNCTION_INTELLIGENCE_MODELS.TEXT.PRO;
  const reservation = await checkOperationBudget({
    userId,
    entitlementTier: entitlementTierToBudgetTier(entitlement.tier),
    operationType: 'video',
    estimatedCost: VIDEO_AD_EVALUATION_RESERVATION_USD,
    operationId: `video-ad-eval-${userId}-${randomUUID()}`,
    metadata: {
      feature: 'video-ad-autorater',
      variantId: parsed.data.variantId,
      shape: parsed.data.shape,
      durationSeconds: parsed.data.durationSeconds,
      model,
    },
  });
  if (!reservation.allowed || !reservation.operationId) {
    throw new HttpsError(
      'resource-exhausted',
      'Video ad evaluation is temporarily unavailable because the account safety budget has been reached.',
    );
  }

  const prompt = [
    `You are a strict Performance Creative Director evaluating a ${parsed.data.durationSeconds}s ${parsed.data.shape} video ad cut (${parsed.data.variantId}).`,
    `CAMPAIGN BRIEF: ${parsed.data.briefSummary}`,
    'Inspect the attached keyframes (0-2s hook, mid-body, CTA end-card) and return strict JSON matching:',
    '{"firstTwoSecondHook":number,"mobileLegibility":number,"safeZoneIntegrity":number,"audioVisualPacing":number,"brandAlignment":number,"overallScore":number,"overallPass":boolean,"gapsFound":string,"refinementPatch":{"fontScaleMultiplier"?:number,"extraSafeMarginPct"?:number,"headlineOverride"?:string,"ctaOverride"?:string}}.',
    `Score each dimension 0-10. Set overallPass=true ONLY if overallScore >= ${VIDEO_AD_PASS_THRESHOLD.toFixed(1)} with zero clipping or legibility defects.`,
  ].join('\n');

  const keyframes = parsed.data.keyframeBase64List.map((frame) => ({
    mimeType: parsed.data.mimeType.toLowerCase(),
    data: stripBase64Prefix(frame),
  }));

  let reservationFinalized = false;
  try {
    const rawText = await dependencies.evaluate({ model, prompt, keyframes });
    let decoded: unknown;
    try {
      decoded = JSON.parse(rawText);
    } catch {
      throw new HttpsError('failed-precondition', 'Gemini 4 Neon could not return a valid video ad evaluation.');
    }

    const parsedScore = rawScoreSchema.safeParse(decoded);
    if (!parsedScore.success) {
      throw new HttpsError('failed-precondition', 'Video ad evaluation output failed schema validation.');
    }

    const raw = parsedScore.data;
    const overallScore = clampScore(raw.overallScore);
    const overallPass = overallScore >= VIDEO_AD_PASS_THRESHOLD && raw.overallPass;
    const refinementPatch = sanitizeRefinementPatch(raw.refinementPatch);

    await finalizeOperationReservation({
      userId,
      operationId: reservation.operationId,
      outcome: 'SETTLED',
      expectedType: 'video',
    });
    reservationFinalized = true;

    return {
      variantId: parsed.data.variantId,
      shape: parsed.data.shape,
      durationSeconds: parsed.data.durationSeconds,
      model,
      firstTwoSecondHook: clampScore(raw.firstTwoSecondHook),
      mobileLegibility: clampScore(raw.mobileLegibility),
      safeZoneIntegrity: clampScore(raw.safeZoneIntegrity),
      audioVisualPacing: clampScore(raw.audioVisualPacing),
      brandAlignment: clampScore(raw.brandAlignment),
      overallScore,
      overallPass,
      gapsFound: raw.gapsFound.trim() || (overallPass ? 'None' : 'Needs refinement'),
      ...(refinementPatch ? { refinementPatch } : {}),
    };
  } catch (error) {
    if (!reservationFinalized) {
      try {
        await finalizeOperationReservation({
          userId,
          operationId: reservation.operationId,
          outcome: 'SETTLED',
          expectedType: 'video',
        });
      } catch (finalizeError) {
        console.error('[evaluateVideoAdCut] Failed to finalize operation reservation:', finalizeError);
      }
    }
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Unable to evaluate the video ad cut right now.');
  }
}

export async function evaluateVideoAdCutHandler(request: CallableRequest<unknown>) {
  return evaluateVideoAdCutRequest(request);
}

export const evaluateVideoAdCut = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '512MiB',
    secrets: [arcjetKey],
    enforceAppCheck: false,
  },
  evaluateVideoAdCutHandler,
);
