/**
 * Direct Image Editor — secured callable image editing adapter.
 *
 * Raw browser SDK access is intentionally disabled. This legacy export name is
 * kept for compatibility, but it routes to the secured `editImage` Cloud
 * Function.
 */

import { AppErrorCode, AppException } from '@/shared/types/errors';
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
 * Edit an image through the secured Cloud Function.
 */
export async function editImageDirectly(options: DirectEditOptions): Promise<DirectEditResult | null> {
    logger.info('[DirectImageEditor] Routing edit request to Cloud Function.');
    const { functions } = await import('@/services/firebase');
    const { httpsCallable } = await import('firebase/functions');
    
    try {
        const editImageFn = httpsCallable(functions, 'editImage');
        const result = await editImageFn(options);
        return result.data as DirectEditResult | null;



    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('[DirectImageEditor] Cloud Function image editing failed:', msg);

        if (msg.includes('403') || msg.includes('API_KEY_INVALID')) {
            throw new AppException(
                AppErrorCode.UNAUTHORIZED,
                'Image editing is not authorized by the secured backend.'
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
            `Image editing failed: ${msg}`
        );
    }
}
