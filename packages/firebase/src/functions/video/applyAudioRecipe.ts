import { createHash } from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
    AudioFilterOperation,
    AudioProfilePreset,
    AudioProfilePresetSchema,
    AudioRecipe,
    AudioRecipeSchema,
    AmbienceBlendModeSchema,
} from '@indii/shared';
import { validateAppCheckV2 } from '../../middleware/appCheck';

const ApplyAudioRecipeRequestSchema = z.object({
    sessionId: z.string().trim().min(1).max(256),
    preset: AudioProfilePresetSchema.default('Natural'),
    ambienceMode: AmbienceBlendModeSchema.default('master_only'),
    ambienceMixLevelDb: z.number().min(-60).max(0).default(-18),
    duckingMusicLevelDb: z.number().min(-60).max(0).default(-12),
    targetLufs: z.number().min(-30).max(-6).default(-16),
}).strict();

export function getPresetFilters(preset: AudioProfilePreset): AudioFilterOperation[] {
    switch (preset) {
        case 'Natural':
            return [
                { operation: 'high_pass', enabled: true, parameters: { cutoffHz: 80 } },
                { operation: 'true_peak_normalize', enabled: true, parameters: { targetLufs: -16, maxPeakDb: -1.0 } },
            ];
        case 'Clean':
            return [
                { operation: 'high_pass', enabled: true, parameters: { cutoffHz: 100 } },
                { operation: 'hum_reduction', enabled: true, parameters: { freqHz: 60 } },
                { operation: 'denoise', enabled: true, parameters: { reductionDb: 12 } },
                { operation: 'compressor', enabled: true, parameters: { ratio: 3.0, thresholdDb: -18 } },
                { operation: 'true_peak_normalize', enabled: true, parameters: { targetLufs: -16, maxPeakDb: -1.0 } },
            ];
        case 'Studio':
            return [
                { operation: 'high_pass', enabled: true, parameters: { cutoffHz: 100 } },
                { operation: 'denoise', enabled: true, parameters: { reductionDb: 15 } },
                { operation: 'compressor', enabled: true, parameters: { ratio: 4.0, thresholdDb: -16 } },
                { operation: 'deess', enabled: true, parameters: { frequencyHz: 6000, reductionDb: 6 } },
                { operation: 'dereverb', enabled: true, parameters: { reductionDb: 8 } },
                { operation: 'true_peak_normalize', enabled: true, parameters: { targetLufs: -14, maxPeakDb: -1.0 } },
            ];
        case 'Rescue':
            return [
                { operation: 'high_pass', enabled: true, parameters: { cutoffHz: 120 } },
                { operation: 'hum_reduction', enabled: true, parameters: { freqHz: 60 } },
                { operation: 'denoise', enabled: true, parameters: { reductionDb: 24 } },
                { operation: 'dereverb', enabled: true, parameters: { reductionDb: 16 } },
                { operation: 'compressor', enabled: true, parameters: { ratio: 6.0, thresholdDb: -12 } },
                { operation: 'true_peak_normalize', enabled: true, parameters: { targetLufs: -16, maxPeakDb: -1.0 } },
            ];
        default:
            return [
                { operation: 'high_pass', enabled: true, parameters: { cutoffHz: 80 } },
            ];
    }
}

export function createApplyAudioRecipeHandler(
    db: FirebaseFirestore.Firestore = getFirestore(),
) {
    return async (rawInput: unknown, authUid: string) => {
        const parseResult = ApplyAudioRecipeRequestSchema.safeParse(rawInput);
        if (!parseResult.success) {
            throw new HttpsError('invalid-argument', 'The audio recipe request payload is malformed.');
        }

        const { sessionId, preset, ambienceMode, ambienceMixLevelDb, duckingMusicLevelDb, targetLufs } = parseResult.data;

        const sessionRef = db.collection('videoSessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists) {
            throw new HttpsError('not-found', 'The specified video session does not exist.');
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = sessionSnap.data() as Record<string, any>;
        if (session.ownerUid !== authUid) {
            throw new HttpsError('permission-denied', 'Cross-owner video session access is prohibited.');
        }

        const recipeId = createHash('sha256')
            .update(`${sessionId}:${preset}:${ambienceMode}:${ambienceMixLevelDb}:${targetLufs}`)
            .digest('hex')
            .slice(0, 40);

        const recipeRef = sessionRef.collection('recipes').doc(recipeId);
        const existingSnap = await recipeRef.get();
        if (existingSnap.exists) {
            const existing = existingSnap.data() as AudioRecipe;
            return { recipe: existing, reused: true };
        }

        const now = new Date().toISOString();
        const newRecipe: AudioRecipe = {
            schemaVersion: 'audio-recipe.v1',
            recipeId,
            ownerUid: authUid,
            organizationId: session.organizationId,
            projectId: session.projectId,
            preset,
            ambienceMode,
            ambienceMixLevelDb,
            duckingMusicLevelDb,
            targetLufs,
            filters: getPresetFilters(preset),
            createdAt: now,
        };

        const validated = AudioRecipeSchema.parse(newRecipe);
        await recipeRef.set(validated);

        return { recipe: validated, reused: false };
    };
}

export const applyAudioRecipe = onCall(async (request) => {
    validateAppCheckV2(request);
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const handler = createApplyAudioRecipeHandler();
    return await handler(request.data, request.auth.uid);
});
