/**
 * Direct Image Generator — Secure backend-proxy calls to Gemini 3 Image models.
 * 
 * This module eliminates all client-side GoogleGenAI SDK usage and key exposures.
 * It routes generation requests to the secure generateImageV3 Cloud Function,
 * returning standard data URIs for perfect backwards compatibility.
 */

import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { APPROVED_MODELS } from '@/core/config/intelligence-models';
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

export async function generateImageDirectly(options: DirectImageOptions): Promise<string[]> {
    logger.info('[DirectImageGenerator] Calling generateImageV3 Cloud Function securely for:', options.prompt);
    
    try {
        const generateImageV3 = httpsCallable(functions, 'generateImageV3');
        
        const payload = {
            prompt: options.prompt,
            aspectRatio: options.aspectRatio || '1:1',
            count: options.numberOfImages || 1,
            model: options.model?.includes('pro') ? 'pro' : 'fast',
            personGeneration: options.personGeneration ? PERSON_GEN_API_MAP[options.personGeneration] : undefined,
            negativePrompt: options.negativePrompt
        };

        const result = await generateImageV3(payload);
        
        interface GenerateImageResponse {
            images: Array<{
                bytesBase64Encoded?: string;
                mimeType?: string;
            }>;
        }

        const data = result.data as GenerateImageResponse;
        const generatedImages: string[] = [];
        
        if (data.images && data.images.length > 0) {
            for (const img of data.images) {
                if (img.bytesBase64Encoded) {
                    const mimeType = img.mimeType || 'image/jpeg';
                    const dataUri = `data:${mimeType};base64,${img.bytesBase64Encoded}`;
                    generatedImages.push(dataUri);
                }
            }
        }
        
        if (generatedImages.length === 0) {
            throw new Error('No images returned from backend generateImageV3 call.');
        }

        logger.info(`[DirectImageGenerator] ✅ Successfully generated ${generatedImages.length} image(s) via backend proxy.`);
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
        
        if (msg.includes('resource-exhausted') || msg.toLowerCase().includes('rate limit')) {
            throw new AppException(
                AppErrorCode.RATE_LIMITED,
                'Image generation quota exceeded or rate limited. Please wait or upgrade your plan.',
                { retryable: true }
            );
        }

        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            `Secure direct generation failed: ${msg}`
        );
    }
}
