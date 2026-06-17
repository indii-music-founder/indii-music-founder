/**
 * Direct Image Editor — Client-side image editing via Gemini SDK.
 *
 * This module bypasses Firebase Cloud Functions entirely. It uses the
 * @google/genai SDK directly from the client to perform image editing
 * (inpainting, outpainting, targeted modifications) using Gemini 3
 * image models with responseModalities: ['IMAGE'].
 *
 * Architecture note: This mirrors DirectImageGenerator's pattern.
 * The Cloud Function path (editImageFn) still exists for production
 * environments with AppCheck, but this direct path is the primary
 * editing pipeline to avoid 401 errors in dev and provide lower latency.
 */

import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { InputSanitizer } from '@/services/intelligence/utils/InputSanitizer';
import { IntelligenceImagePromptService } from '@/services/image/IntelligenceImagePromptService';
import { logger } from '@/utils/logger';

export interface DirectEditOptions {
    /** Source image to edit */
    image: { mimeType: string; data: string };
    /** Binary mask indicating the region to edit (white = edit, black = preserve) */
    mask?: { mimeType: string; data: string };
    /** Reference image for style/composition guidance */
    referenceImage?: { mimeType: string; data: string };
    /** Edit instruction prompt */
    prompt: string;
    /** Use Pro model for higher fidelity */
    forceHighFidelity?: boolean;
    /** Model tier: 'pro' or 'flash' */
    model?: 'pro' | 'flash' | string;
    /** Thought signature for reasoning continuity across chained edits */
    thoughtSignature?: string;
    /** Whether the mask is a semantic (multi-color) map vs binary */
    useSemanticMap?: boolean;
}

export interface DirectEditResult {
    id: string;
    url: string;
    prompt: string;
    thoughtSignature?: string;
}

/**
 * Edit an image directly via the Gemini SDK, bypassing Cloud Functions.
 *
 * Supports:
 * - Source image + text instruction (remix)
 * - Source image + binary mask + instruction (inpainting)
 * - Source image + semantic mask + instruction (multi-region editing)
 * - Reference image for composition guidance
 * - Thought signature circulation for chained edits
 */
export async function editImageDirectly(options: DirectEditOptions): Promise<DirectEditResult | null> {
    logger.info('[DirectImageEditor] Proxying edit request to Cloud Function (direct API disabled for security).');
    const { functions } = await import('@/services/firebase');
    const { httpsCallable } = await import('firebase/functions');
    
    try {
        const editImageFn = httpsCallable(functions, 'editImage');
        const result = await editImageFn(options);
        return result.data as DirectEditResult | null;



    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('[DirectImageEditor] Direct image editing failed:', msg);

        if (msg.includes('403') || msg.includes('API_KEY_INVALID')) {
            throw new AppException(
                AppErrorCode.UNAUTHORIZED,
                'Invalid Gemini API Key. Direct editing requires a valid VITE_API_KEY in your environment.'
            );
        }

        if (msg.includes('429') || msg.includes('quota') || msg.toLowerCase().includes('rate limit')) {
            throw new AppException(
                AppErrorCode.RATE_LIMITED,
                'Gemini API quota exceeded or rate limited. Please wait or check your GCP billing.',
                { retryable: true }
            );
        }

        if (msg.includes('400')) {
            throw new AppException(
                AppErrorCode.INVALID_ARGUMENT,
                `Image editing request was invalid: ${msg}`
            );
        }

        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            `Direct image editing failed: ${msg}`
        );
    }
}
