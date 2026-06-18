/**
 * SpeechGenerator — backend-only TTS generation.
 *
 * Browser-side Firebase AI is disabled. Speech routes through the secured
 * generateSpeech callable Cloud Function, which holds Google credentials on
 * the server and enforces Auth/App Check.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import type { IntelligenceContext } from '../IntelligenceContext';
import type { GenerateSpeechResponse } from '@/shared/types/ai.dto';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';

interface GenerateSpeechCallableResponse {
    audioContent?: string;
    mimeType?: string;
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

    return ctx.mediaBreaker.execute(async () => {
        await ctx.ensureInitialized();

        const generateSpeechFn = httpsCallable<
            { text: string; voice: string; model: string },
            GenerateSpeechCallableResponse
        >(functions, 'generateSpeech');

        try {
            const result = await generateSpeechFn({
                text,
                voice,
                model: modelOverride || INTELLIGENCE_MODELS.AUDIO.PRO,
            });

            if (!result.data.audioContent) {
                throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Speech backend returned no audio content');
            }

            return {
                audio: {
                    inlineData: {
                        mimeType: result.data.mimeType || 'audio/wav',
                        data: result.data.audioContent,
                    },
                },
            };
        } catch (error: unknown) {
            throw ctx.handleError(error);
        }
    });
}
