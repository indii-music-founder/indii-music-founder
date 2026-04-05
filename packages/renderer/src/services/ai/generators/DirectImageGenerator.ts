/**
 * Direct Image Generator — Direct client-side calls to Gemini 3 Image models.
 * 
 * This module bypasses Firebase Cloud Functions entirely. It uses the
 * @google/genai SDK directly from the client to call Nano Banana Pro
 * and Nano Banana 2 models using responseModalities: ['IMAGE'].
 */

import { GoogleGenAI } from '@google/genai';
import { AI_MODELS, APPROVED_MODELS } from '@/core/config/ai-models';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { logger } from '@/utils/logger';

export interface DirectImageOptions {
    prompt: string;
    model?: typeof APPROVED_MODELS.DIRECT_PRO | typeof APPROVED_MODELS.DIRECT_FAST;
    aspectRatio?: string; // "1:1", "16:9", "9:16", "4:3", "3:4"
    numberOfImages?: number; // 1-4
    personGeneration?: 'allow_adult' | 'dont_allow';
    negativePrompt?: string; // Only supported on Pro
}

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
    const modelId = options.model || AI_MODELS.IMAGE.DIRECT_PRO;

    logger.info('[DirectImageGenerator] Generating image directly with SDK:', {
        model: modelId,
        aspectRatio: options.aspectRatio,
        count: options.numberOfImages || 1
    });

    try {
        // Build the generation config
        // Using responseModalities: ['IMAGE'] is required for Gemini 3 image models
        const config: Record<string, unknown> = {
            responseModalities: ['IMAGE'],
            candidateCount: options.numberOfImages || 1,
        };

        // Add optional config block for specific image params
        const imageConfig: Record<string, unknown> = {};

        if (options.aspectRatio) {
            imageConfig.aspectRatio = options.aspectRatio;
        }

        if (options.personGeneration) {
            imageConfig.personGenerationConfig = options.personGeneration;
        }

        // Negative prompt is only supported on the Pro model (Nano Banana Pro)
        const isPro = modelId.includes('pro');
        if (options.negativePrompt && isPro) {
            // Note: Currently negative prompt might not be standard in all Gemini 3 preview SDKs
            // but we pass it anyway based on Nano Banana Pro specs.
            // If it causes 400 errors, we'll need to remove it from this payload.
            config.negativePrompt = options.negativePrompt;
        }

        if (Object.keys(imageConfig).length > 0) {
            config.imageConfig = imageConfig;
        }

        // Setup tools: Nano Banana 2 features Search Grounding, we enable it generally 
        // to match the "Pro/Fast" specs
        const tools: Array<Record<string, unknown>> = [{ googleSearch: {} }];
        config.tools = tools;

        // Call the direct generateContent API
        const response = await client.models.generateContent({
            model: modelId,
            contents: options.prompt,
            config: config as Parameters<typeof client.models.generateContent>[0]['config'],
        });

        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error('No candidates returned from direct API call.');
        }

        const generatedImages: string[] = [];

        // Extract base64 images from all candidates
        for (const candidate of candidates) {
            logger.info('[DirectImageGenerator] Candidate parts:', candidate.content?.parts?.length || 0);

            // Iterate through parts to find inlineData containing the image
            const imagePart = candidate.content?.parts?.find(
                p => p.inlineData && p.inlineData.mimeType?.startsWith('image/')
            );

            if (imagePart && imagePart.inlineData?.data) {
                const mimeType = imagePart.inlineData.mimeType || 'image/jpeg';
                const base64Bytes = imagePart.inlineData.data;
                const dataUri = `data:${mimeType};base64,${base64Bytes}`;
                generatedImages.push(dataUri);
            } else {
                // Check if generation was blocked by safety filters
                const textPart = candidate.content?.parts?.find(p => 'text' in p);
                if (textPart && 'text' in textPart && typeof textPart.text === 'string') {
                    logger.warn('[DirectImageGenerator] Received text instead of image (likely safety block):', textPart.text);
                } else {
                    logger.warn('[DirectImageGenerator] Candidate part missing image data and text. Part keys:',
                        candidate.content?.parts?.map(p => Object.keys(p)).flat());
                }
            }
        }

        if (generatedImages.length === 0) {
            throw new Error(`Generation completed but no valid image data was extracted from ${candidates.length} candidate(s).`);
        }

        logger.info(`[DirectImageGenerator] ✅ Successfully generated ${generatedImages.length} image(s) directly.`);
        return generatedImages;

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('[DirectImageGenerator] Direct image generation failed:', msg);

        if (msg.includes('403') || msg.includes('API_KEY_INVALID')) {
            throw new AppException(
                AppErrorCode.UNAUTHORIZED,
                'Invalid Gemini API Key. Direct generation requires a valid VITE_API_KEY in your environment.'
            );
        }

        if (msg.includes('429') || msg.includes('quota') || msg.toLowerCase().includes('rate limit')) {
            throw new AppException(
                AppErrorCode.RATE_LIMITED,
                'Gemini API quota exceeded or rate limited. Please wait or check your GCP billing.',
                { retryable: true }
            );
        }

        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            `Direct generation failed: ${msg}`
        );
    }
}
