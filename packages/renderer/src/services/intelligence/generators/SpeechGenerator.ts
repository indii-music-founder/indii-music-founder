/**
 * SpeechGenerator — backend-only TTS generation.
 *
 * Browser-side Firebase AI is disabled. Speech routes through the secured
 * generateAudioV3 callable Cloud Function, which holds Google credentials on
 * the server and atomically persists every successful result.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import type { IntelligenceContext } from '../IntelligenceContext';
import type { GenerateSpeechResponse } from '@/shared/types/ai.dto';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

interface GenerateSpeechCallableResponse {
    mimeType?: string;
    jobId?: string;
    libraryAssetId?: string;
    resultUri?: string;
}

export async function generateSpeech(
    ctx: IntelligenceContext,
    text: string,
    voice: string = 'Kore',
    modelOverride?: string
): Promise<GenerateSpeechResponse> {
    if (!text || text.trim().length === 0) {
        throw new AppException(AppErrorCode.INVALID_ARGUMENT, 'Cannot generate speech for empty text');
    }
    if (modelOverride && modelOverride !== INTELLIGENCE_MODELS.AUDIO.TTS) {
        throw new AppException(
            AppErrorCode.INVALID_ARGUMENT,
            `Unsupported speech model override: ${modelOverride}`
        );
    }

    return ctx.mediaBreaker.execute(async () => {
        await ctx.ensureInitialized();

        const generateSpeechFn = httpsCallable<
            { prompt: string; voice: string; requestId: string },
            GenerateSpeechCallableResponse
        >(functions, 'generateAudioV3');

        try {
            const result = await generateSpeechFn({
                prompt: text,
                voice,
                requestId: crypto.randomUUID(),
            });

            if (!result.data.resultUri || !result.data.libraryAssetId) {
                throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Speech backend returned no durable audio receipt');
            }
            const playbackUrl = await resolveStorageUrl(result.data.resultUri);
            if (playbackUrl.startsWith('gs://')) {
                throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Stored speech could not be resolved for playback');
            }

            return {
                audio: {
                    mimeType: result.data.mimeType || 'audio/wav',
                    playbackUrl,
                },
                ...(result.data.libraryAssetId && result.data.resultUri
                    ? {
                        persistedAsset: {
                            id: result.data.libraryAssetId,
                            storageUrl: result.data.resultUri,
                        },
                    }
                    : {}),
            };
        } catch (error: unknown) {
            throw ctx.handleError(error);
        }
    });
}
