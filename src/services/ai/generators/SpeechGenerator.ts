/**
 * SpeechGenerator — Extracted TTS generation logic from FirebaseAIService.
 *
 * Handles text-to-speech via the gemini-2.5-pro-preview-tts model.
 * Supports both Firebase AI SDK (normal mode) and direct @google/genai
 * SDK (fallback mode).
 */

import { getGenerativeModel } from 'firebase/ai';
import type { InlineDataPart as FirebaseInlineDataPart } from 'firebase/ai';
import { getFirebaseAI } from '@/services/firebase';
import type { AIContext } from '../AIContext';
import type { GenerationConfig, ContentPart, GenerateSpeechResponse } from '@/shared/types/ai.dto';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { AI_MODELS } from '@/core/config/ai-models';
import { isAppCheckError } from '../appcheck';
import { logger } from '@/utils/logger';

/**
 * Generate speech from text using gemini-2.5-pro-preview-tts.
 *
 * Supports both Firebase AI SDK (with App Check) and direct @google/genai
 * SDK (fallback mode when App Check is unavailable).
 */
export async function generateSpeech(
    ctx: AIContext,
    text: string,
    voice: string = 'Kore',
    modelOverride?: string
): Promise<GenerateSpeechResponse> {
    if (!text || text.trim().length === 0) {
        throw new AppException(AppErrorCode.INVALID_ARGUMENT, 'Cannot generate speech for empty text');
    }

    return ctx.mediaBreaker.execute(async () => {
        await ctx.ensureInitialized();

        const modelName = modelOverride || AI_MODELS.AUDIO.PRO;

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

        // FALLBACK MODE: Use direct Gemini SDK (new @google/genai)
        if (ctx.useFallbackMode && ctx.fallbackClient) {
            try {
                const result = await ctx.fallbackClient.models.generateContent({
                    model: modelName,
                    contents: [{ role: 'user', parts: [{ text }] }] as unknown as Record<string, unknown>[],
                    config: config as unknown as Record<string, unknown>
                });

                const candidates = result.candidates;

                if (!candidates || candidates.length === 0) {
                    throw new Error('No candidates returned from TTS fallback model');
                }

                const parts = (candidates[0]!.content?.parts || []) as ContentPart[];
                const audioPart = parts.find(p => 'inlineData' in p && p.inlineData?.mimeType.startsWith('audio/'));

                if (!audioPart || !('inlineData' in audioPart)) {
                    throw new Error('No audio data found in fallback response parts');
                }

                return {
                    audio: {
                        inlineData: {
                            mimeType: audioPart.inlineData.mimeType,
                            data: audioPart.inlineData.data
                        }
                    }
                };
            } catch (error) {
                throw ctx.handleError(error);
            }
        }

        // NORMAL MODE: Use Firebase AI SDK
        const firebaseAI = getFirebaseAI();

        // Auto-switch to fallback if Firebase AI is missing
        if (!firebaseAI) {
            logger.warn('[SpeechGenerator] Firebase AI not available for speech, switching to fallback');
            await ctx.initializeFallbackMode();
            return generateSpeech(ctx, text, voice, modelOverride);
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
        } catch (error) {
            // If we hit an App Check error during normal mode, switch to fallback
            if (isAppCheckError(error) && !ctx.useFallbackMode) {
                logger.warn('[SpeechGenerator] App Check error during speech, switching to fallback mode');
                await ctx.initializeFallbackMode();
                return generateSpeech(ctx, text, voice, modelOverride);
            }
            throw ctx.handleError(error);
        }
    });
}
