/**
 * SpeechGenerator — Extracted TTS generation logic from FirebaseIntelligenceService.
 *
 * Handles text-to-speech via the gemini-2.5-pro-preview-tts model.
 * Supports Firebase AI with App Check.
 */

import { getGenerativeModel } from 'firebase/ai';
import type { InlineDataPart as FirebaseInlineDataPart } from 'firebase/ai';
import { getFirebaseAI } from '@/services/firebase';
import type { IntelligenceContext } from '../IntelligenceContext';
import type { GenerationConfig, ContentPart, GenerateSpeechResponse } from '@/shared/types/ai.dto';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { isAppCheckError } from '../appcheck';
import { logger } from '@/utils/logger';

/**
 * Generate speech from text using gemini-2.5-pro-preview-tts.
 *
 * Supports Firebase AI with App Check.
 */
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

        const modelName = modelOverride || INTELLIGENCE_MODELS.AUDIO.PRO;

        const config: GenerationConfig = {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: voice
                    }
                }
            }
        };

        // Raw browser fallback is disabled.
        if (ctx.useFallbackMode && ctx.fallbackClient) {
            throw new AppException(AppErrorCode.UNAUTHORIZED, 'Raw speech generation fallback is disabled in the browser.');
        }

        // NORMAL MODE: Use Firebase Autonomous SDK
        const firebaseAI = getFirebaseAI();

        if (!firebaseAI) {
            throw new AppException(AppErrorCode.INTERNAL_ERROR, 'Firebase AI is not available for speech generation.');
        }

        const modelCallback = getGenerativeModel(firebaseAI, {
            model: modelName,
            generationConfig: config as unknown as Record<string, unknown>
        });

        try {
            const result = await modelCallback.generateContent(text);
            const candidates = result.response.candidates;

            if (!candidates || candidates.length === 0) {
                throw new Error('No candidates returned from TTS model');
            }

            const audioPart = candidates[0]!.content?.parts?.find(p => p && 'inlineData' in p && p.inlineData?.mimeType.startsWith('audio/')) as FirebaseInlineDataPart | undefined;

            if (!audioPart || !audioPart.inlineData) {
                throw new Error('No audio data found in response parts');
            }

            return {
                audio: {
                    inlineData: {
                        mimeType: audioPart.inlineData.mimeType,
                        data: audioPart.inlineData.data
                    }
                }
            };
        } catch (error: unknown) {
            if (isAppCheckError(error) && !ctx.useFallbackMode) {
                logger.warn('[SpeechGenerator] App Check error during speech generation');
            }
            throw ctx.handleError(error);
        }
    });
}
