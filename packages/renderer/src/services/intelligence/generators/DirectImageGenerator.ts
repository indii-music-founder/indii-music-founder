/**
 * Direct Image Generator — Secure backend-proxy calls to Gemini 3 Image models.
 * 
 * This module eliminates all client-side GoogleGenAI SDK usage and key exposures.
 * It delegates to the canonical image service rather than speaking the
 * callable protocol. That service owns authenticated cost reservations,
 * owner-scoped reference uploads, and canonical Storage result handling.
 */

import { APPROVED_MODELS } from '@/core/config/intelligence-models';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { logger } from '@/utils/logger';
import { ImageGeneration } from '@/services/image/ImageGenerationService';

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

export async function generateImageDirectly(options: DirectImageOptions): Promise<string[]> {
    logger.info('[DirectImageGenerator] Delegating through the canonical image service.');
    
    try {
        const results = await ImageGeneration.generateImages({
            prompt: options.prompt,
            aspectRatio: options.aspectRatio || '1:1',
            count: options.numberOfImages || 1,
            model: options.model?.includes('pro') ? 'pro' : 'fast',
            personGeneration: options.personGeneration ? PERSON_GEN_API_MAP[options.personGeneration] : undefined,
            negativePrompt: options.negativePrompt,
        });
        const generatedImages = results.map(result => result.url);
        if (generatedImages.length === 0) {
            throw new Error('No canonical image result was returned.');
        }

        logger.info(`[DirectImageGenerator] Generated ${generatedImages.length} canonical image result(s).`);
        return generatedImages;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('[DirectImageGenerator] Secure backend generation failed:', msg);
        
        if (msg.includes('unauthenticated')) {
            throw new AppException(
                AppErrorCode.UNAUTHORIZED,
                'You must be signed in to generate images.'
            );
        }
        
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes('resource-exhausted') || lowerMsg.includes('resource_exhausted') || lowerMsg.includes('rate limit') || lowerMsg.includes('quota')) {
            throw new AppException(
                AppErrorCode.RATE_LIMITED,
                'Image generation capacity is temporarily limited. Please wait and try again.',
                { retryable: true }
            );
        }

        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            `Secure direct generation failed: ${msg}`
        );
    }
}
