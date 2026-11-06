import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { FUNCTION_INTELLIGENCE_MODELS } from '../../config/models';
import { validateAppCheckV2 } from '../../middleware/appCheck';
import { getVertexAIClient } from '../../lib/vertexClient';
import { arcjetKey } from '../../config/secrets';
import { protectAuthenticatedApiRequest } from '../security/arcjet';
import { entitlementTierToBudgetTier, requireVerifiedServerEntitlement } from '../auth/entitlements';
import { policyClassForServerEntitlement } from '../security/arcjet';
import { checkOperationBudget, finalizeOperationReservation, requireVerifiedCreativeUser } from '../billing/enforceOperationCost';

const requestSchema = z.object({
  storagePath: z.string().min(1).max(512),
  durationSeconds: z.number().finite().positive().max(420),
}).strict();

const candidateSchema = z.object({
  section: z.enum(['INTRO', 'VERSE', 'PRE_CHORUS', 'CHORUS', 'BRIDGE', 'DROP', 'OUTRO']),
  startTimeSeconds: z.number().finite().nonnegative(),
  endTimeSeconds: z.number().finite().positive(),
  energyLevel: z.enum(['low', 'moderate', 'high', 'peak']),
  lyricSnippet: z.string().max(180).default(''),
});

export const CAMPAIGN_AUDIO_ANALYSIS_RESERVATION_USD = 0.03;

function isOwnedTemporaryAudioPath(userId: string, storagePath: string): boolean {
  const prefix = `tmp/audio-analysis/${userId}/free-campaign/`;
  if (!storagePath.startsWith(prefix)) return false;
  return /^[0-9a-f-]{36}\.(mp3|wav|m4a|aac|flac|ogg|webm)$/i.test(storagePath.slice(prefix.length));
}

async function analyzeCampaignAudioRequest(
  request: CallableRequest<unknown>,
  dependencies: {
    analyze: (storageUri: string, mimeType: string) => Promise<string>;
  } = {
    analyze: async (storageUri, mimeType) => {
      const client = getVertexAIClient();
      const response = await client.models.generateContent({
        model: FUNCTION_INTELLIGENCE_MODELS.AUDIO.ANALYSIS,
        contents: [{ role: 'user', parts: [
          { text: 'Listen to this complete song and return JSON only: {"candidates":[{"section":"INTRO|VERSE|PRE_CHORUS|CHORUS|BRIDGE|DROP|OUTRO","startTimeSeconds":number,"endTimeSeconds":number,"energyLevel":"low|moderate|high|peak","lyricSnippet":"short audible lyric or empty"}]}. Give at most three distinct, high-quality 8–15 second teaser windows with precise start times. Prefer a memorable vocal/melodic hook or a clear instrumental payoff that works immediately. Do not invent lyrics, section names, or timestamps; return an empty candidates array when no reliable moment can be identified.' },
          { fileData: { fileUri: storageUri, mimeType } },
        ] }],
        config: { responseMimeType: 'application/json', audioTimestamp: true, temperature: 0.1, maxOutputTokens: 512 },
      });
      return response.text ?? '';
    },
  },
): Promise<{ candidates: z.infer<typeof candidateSchema>[] }> {
  validateAppCheckV2(request);
  const userId = requireVerifiedCreativeUser(request.auth);
  const entitlement = await requireVerifiedServerEntitlement(userId);
  const protection = await protectAuthenticatedApiRequest(request.rawRequest, {
    userId,
    policy: policyClassForServerEntitlement({ tier: entitlement.tier, isAdmin: request.auth?.token.admin === true }),
    operationId: `campaign-audio-analysis:${userId}:${randomUUID()}`,
  });
  if (!protection.allowed) {
    const code = protection.status === 429 ? 'resource-exhausted' : protection.status === 403 ? 'permission-denied' : 'unavailable';
    throw new HttpsError(code, protection.message);
  }

  const parsed = requestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', 'A valid temporary audio upload belonging to this account is required.');
  }
  if (!isOwnedTemporaryAudioPath(userId, parsed.data.storagePath)) {
    throw new HttpsError('invalid-argument', 'A valid temporary audio upload belonging to this account is required.');
  }

  const bucket = admin.storage().bucket();
  const file = bucket.file(parsed.data.storagePath);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  const mimeType = typeof metadata.contentType === 'string' ? metadata.contentType : '';
  const allowedMimeTypes = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/ogg', 'audio/webm']);
  if (!Number.isFinite(size) || size <= 0 || size > 35 * 1024 * 1024 || !allowedMimeTypes.has(mimeType.toLowerCase())) {
    throw new HttpsError('invalid-argument', 'The temporary audio upload is not a supported campaign track.');
  }

  const reservation = await checkOperationBudget({
    userId,
    entitlementTier: entitlementTierToBudgetTier(entitlement.tier),
    operationType: 'audio',
    estimatedCost: CAMPAIGN_AUDIO_ANALYSIS_RESERVATION_USD,
    operationId: `campaign-audio-${userId}-${randomUUID()}`,
    metadata: { feature: 'free-mini-campaign', model: FUNCTION_INTELLIGENCE_MODELS.AUDIO.ANALYSIS, maxDurationSeconds: 420 },
  });
  if (!reservation.allowed || !reservation.operationId) {
    throw new HttpsError('resource-exhausted', 'Track analysis is temporarily unavailable because the account safety budget has been reached.');
  }

  try {
    const text = await dependencies.analyze(`gs://${bucket.name}/${parsed.data.storagePath}`, mimeType);
    let decoded: unknown;
    try { decoded = JSON.parse(text); } catch { throw new HttpsError('failed-precondition', 'Gemini could not return reliable teaser moments for this track.'); }
    const candidates = z.object({ candidates: z.array(candidateSchema).max(3) }).safeParse(decoded);
    const safeCandidates = candidates.success
      ? candidates.data.candidates.flatMap(candidate => {
        const endTimeSeconds = Math.min(candidate.endTimeSeconds, parsed.data.durationSeconds);
        return candidate.startTimeSeconds < parsed.data.durationSeconds
          && endTimeSeconds - candidate.startTimeSeconds >= 3
          ? [{ ...candidate, endTimeSeconds }]
          : [];
      })
      : [];
    if (safeCandidates.length === 0) throw new HttpsError('failed-precondition', 'Gemini could not identify a reliable teaser moment. Try another track.');
    await finalizeOperationReservation({ userId, operationId: reservation.operationId, outcome: 'SETTLED', expectedType: 'audio' });
    return { candidates: safeCandidates };
  } catch (error) {
    await finalizeOperationReservation({ userId, operationId: reservation.operationId, outcome: 'SETTLED', expectedType: 'audio' });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', 'Unable to analyze the campaign audio right now.');
  }
}

export async function analyzeCampaignAudioHandler(request: CallableRequest<unknown>) {
  return analyzeCampaignAudioRequest(request);
}

export const analyzeCampaignAudio = onCall(
  { region: 'us-central1', timeoutSeconds: 120, memory: '1GiB', cpu: 'gcf_gen1', concurrency: 1, secrets: [arcjetKey], enforceAppCheck: false },
  analyzeCampaignAudioHandler,
);
