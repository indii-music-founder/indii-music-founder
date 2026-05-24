/**
 * Direct Image Generator — Direct client-side calls to Gemini 3 Image models.
 * 
 * This module bypasses Firebase Cloud Functions entirely. It uses the
 * @google/genai SDK directly from the client to call Nano Banana Pro
 * and Nano Banana 2 models using responseModalities: ['IMAGE'].
 */

import { GoogleGenAI } from '@google/genai';
import { INTELLIGENCE_MODELS, APPROVED_MODELS } from '@/core/config/intelligence-models';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { logger } from '@/utils/logger';

export interface DirectImageOptions {
    prompt: string;
    model?: typeof APPROVED_MODELS.DIRECT_PRO | typeof APPROVED_MODELS.DIRECT_FAST;
    aspectRatio?: string; // "1:1", "16:9", "9:16", "4:3", "3:4"
    numberOfImages?: number; // 1-4
    personGeneration?: 'allow_adult' | 'dont_allow' | 'allow_all';
    negativePrompt?: string; // Only supported on Pro
}

/** Map UI-friendly person generation values to Gemini API uppercase constants. */
const PERSON_GEN_API_MAP: Record<string, string> = {
    'allow_adult': 'ALLOW_ADULT',
    'dont_allow': 'ALLOW_NONE',
    'allow_all': 'ALLOW_ALL',
};

/**
 * Direct call to Gemini 3.1 Image generation via the @google/genai SDK.
 */
export async function generateImageDirectly(options: DirectImageOptions): Promise<string[]> {
    // Determine the environment API key
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) {
        throw new AppException(AppErrorCode.UNAUTHORIZED, 'Missing Gemini API Key for Direct Generation.');
    }

    // Initialize direct client
    const client = new GoogleGenAI({ apiKey });

    // Determine model (default to Pro)
    const modelId = options.model || INTELLIGENCE_MODELS.IMAGE.DIRECT_PRO;

    const modelAttempts = [
        modelId,
        'imagen-3.0-generate-002', // Standard production fallback
    ];

    let lastError: unknown;

    async function executeGeneration(attemptModel: string): Promise<string[]> {
        const isImagen = attemptModel.includes('imagen-');
        const generatedImages: string[] = [];

        if (isImagen) {
            // Setup the configuration for generateImages
            const imageConfig: Record<string, unknown> = {
                numberOfImages: options.numberOfImages || 1,
            };

            if (options.aspectRatio) {
                imageConfig.aspectRatio = options.aspectRatio;
            }

            if (options.personGeneration) {
                imageConfig.personGeneration = PERSON_GEN_API_MAP[options.personGeneration] ?? 'ALLOW_ADULT';
            }

            // Negative prompt is only supported on Pro/Ultra models
            const isPro = attemptModel.includes('pro') || attemptModel.includes('ultra') || attemptModel.includes('3.0-generate');
            if (options.negativePrompt && isPro) {
                imageConfig.negativePrompt = options.negativePrompt;
            }

            logger.info('[DirectImageGenerator] Calling generateImages with:', { 
                model: attemptModel, 
                config: imageConfig 
            });

            // Call the correct SDK method
            const response = await client.models.generateImages({
                model: attemptModel,
                prompt: options.prompt,
                config: imageConfig as any,
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
                for (const generatedImage of response.generatedImages) {
                    const img = generatedImage.image;
                    if (img) {
                        const base64Bytes = img.imageBytes;
                        const mimeType = img.mimeType || 'image/jpeg';
                        const dataUri = `data:${mimeType};base64,${base64Bytes}`;
                        generatedImages.push(dataUri);
                    }
                }
            } else {
                throw new Error('No images returned from generateImages SDK call.');
            }
        } else {
            // Legacy/Gemini responseModalities path for multimodal models
            const config: Record<string, unknown> = {
                responseModalities: ['IMAGE'],
                candidateCount: options.numberOfImages || 1,
            };

            const imageConfig: Record<string, unknown> = {};

            if (options.aspectRatio) {
                imageConfig.aspectRatio = options.aspectRatio;
            }

            if (options.personGeneration) {
                imageConfig.personGeneration = PERSON_GEN_API_MAP[options.personGeneration] ?? 'ALLOW_ADULT';
            }

            if (Object.keys(imageConfig).length > 0) {
                config.imageConfig = imageConfig;
            }

            logger.info('[DirectImageGenerator] Calling generateContent with responseModalities for model:', attemptModel);

            const response = await client.models.generateContent({
                model: attemptModel,
                contents: options.prompt,
                config: config as any,
            });

            const candidates = response.candidates;
            if (!candidates || candidates.length === 0) {
                throw new Error('No candidates returned from direct API call.');
            }

            for (const candidate of candidates) {
                const imagePart = candidate.content?.parts?.find(
                    (p: any) => p.inlineData && p.inlineData.mimeType?.startsWith('image/')
                );

                if (imagePart && imagePart.inlineData?.data) {
                    const mimeType = imagePart.inlineData.mimeType || 'image/jpeg';
                    const base64Bytes = imagePart.inlineData.data;
                    const dataUri = `data:${mimeType};base64,${base64Bytes}`;
                    generatedImages.push(dataUri);
                }
            }
        }

        if (generatedImages.length === 0) {
            throw new Error('Generation completed but no valid image data was extracted.');
        }

        logger.info(`[DirectImageGenerator] ✅ Successfully generated ${generatedImages.length} image(s) directly.`);
        return generatedImages;
    }

    for (const attemptModel of modelAttempts) {
        try {
            logger.info(`[DirectImageGenerator] Attempting generation with model: ${attemptModel}`);
            const result = await executeGeneration(attemptModel);
            return result;
        } catch (error: unknown) {
            lastError = error;
            const msg = error instanceof Error ? error.message : String(error);
            logger.warn(`[DirectImageGenerator] Model ${attemptModel} failed: ${msg}`);

            // If the key is invalid (403), don't try other models since it will fail anyway
            if (msg.includes('403') || msg.includes('API_KEY_INVALID')) {
                break;
            }
        }
    }

    // If we reach here, all attempts failed. Handle error / dev mock fallback
    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    logger.error('[DirectImageGenerator] Direct image generation failed across all models:', msg);

    if (msg.includes('403') || msg.includes('API_KEY_INVALID')) {
        throw new AppException(
            AppErrorCode.UNAUTHORIZED,
            'Invalid Gemini API Key. Direct generation requires a valid VITE_API_KEY in your environment.'
        );
    }

    if (msg.includes('429') || msg.includes('quota') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('resource exhausted')) {
        // Unblock local development/E2E testing if quota is exceeded
        if (import.meta.env.DEV || import.meta.env.VITE_SKIP_ONBOARDING === 'true') {
            logger.warn('[DirectImageGenerator] ⚠️ Gemini API quota exceeded. Generating mock image for DEV mode.');
            return ['data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1PQ0sgSU1BR0U8L3RleHQ+PC9zdmc+'];
        }

        throw new AppException(
            AppErrorCode.RATE_LIMITED,
            'Gemini API quota exceeded or rate limited. Please wait or check your GCP billing.',
            { retryable: true }
        );
    }

    // Default mock fallback for general development failures
    if (import.meta.env.DEV) {
        logger.warn('[DirectImageGenerator] ⚠️ Fallback to mock image in DEV mode due to failure:', msg);
        return ['data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjY2NjIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk1PQ0sgSU1BR0U8L3RleHQ+PC9zdmc+'];
    }

    throw new AppException(
        AppErrorCode.INTERNAL_ERROR,
        `Direct generation failed: ${msg}`
    );
}

