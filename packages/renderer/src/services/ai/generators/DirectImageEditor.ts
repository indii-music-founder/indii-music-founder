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

import { GoogleGenAI } from '@google/genai';
import { AI_MODELS } from '@/core/config/ai-models';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { InputSanitizer } from '@/services/ai/utils/InputSanitizer';
import { PromptBuilder } from '@/services/image/PromptBuilderService';
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
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) {
        throw new AppException(AppErrorCode.UNAUTHORIZED, 'Missing Gemini API Key for Direct Editing.');
    }

    const client = new GoogleGenAI({ apiKey });

    // Determine model
    const useHighFidelity = options.model === 'pro' || options.forceHighFidelity;
    const modelId = useHighFidelity ? AI_MODELS.IMAGE.DIRECT_PRO : AI_MODELS.IMAGE.DIRECT_FAST;

    // Determine task label for PromptBuilder
    let taskLabel = "Object Modification via Visual Prompt";
    if (options.useSemanticMap) taskLabel = "Semantic Image Editing";
    else if (options.mask) taskLabel = "Targeted Image Inpainting";

    // Build structured prompt
    const structuredPrompt = PromptBuilder.build({
        userPrompt: InputSanitizer.sanitize(options.prompt),
        useDualView: !!options.mask,
        useSemanticMap: !!options.useSemanticMap,
        task: taskLabel
    });

    logger.info('[DirectImageEditor] Editing image directly with SDK:', {
        model: modelId,
        hasMask: !!options.mask,
        hasReference: !!options.referenceImage,
        useSemanticMap: !!options.useSemanticMap,
        promptSnippet: structuredPrompt.substring(0, 80)
    });

    try {
        // Build content parts: images first, then text (consistent with Cloud Function ordering)
        const parts: Array<Record<string, unknown>> = [];

        // 1. Source image
        parts.push({
            inlineData: {
                mimeType: options.image.mimeType,
                data: options.image.data,
            }
        });

        // 2. Mask (if provided)
        if (options.mask) {
            parts.push({
                inlineData: {
                    mimeType: options.mask.mimeType,
                    data: options.mask.data,
                }
            });
        }

        // 3. Reference image (if provided)
        if (options.referenceImage) {
            parts.push({
                inlineData: {
                    mimeType: options.referenceImage.mimeType,
                    data: options.referenceImage.data,
                }
            });
        }

        // 4. Prompt text (after images)
        const promptText = options.mask
            ? `Edit the masked region of this image according to this instruction: ${structuredPrompt}`
            : structuredPrompt;
        parts.push({ text: promptText });

        // 5. Thought signature for reasoning continuity
        if (options.thoughtSignature) {
            parts.push({ thought_signature: options.thoughtSignature });
        }

        // Build config
        const config: Record<string, unknown> = {
            responseModalities: ['IMAGE'],
        };

        // Call the Gemini SDK directly
        const response = await client.models.generateContent({
            model: modelId,
            contents: [{ role: 'user', parts }] as Parameters<typeof client.models.generateContent>[0]['contents'],
            config: config as Parameters<typeof client.models.generateContent>[0]['config'],
        });

        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
            logger.warn('[DirectImageEditor] No candidates returned from edit API call.');
            return null;
        }

        // Extract the image from the first candidate
        const candidate = candidates[0];
        const responseParts = candidate?.content?.parts;

        if (!responseParts || responseParts.length === 0) {
            logger.warn('[DirectImageEditor] No content parts in edit response.');
            return null;
        }

        // Find the image part
        const imagePart = responseParts.find(
            p => p.inlineData && p.inlineData.mimeType?.startsWith('image/')
        );

        if (imagePart && imagePart.inlineData?.data) {
            const mimeType = imagePart.inlineData.mimeType || 'image/png';
            const base64Data = imagePart.inlineData.data;
            const url = `data:${mimeType};base64,${base64Data}`;

            // Extract thought signature if present (cast through unknown to bypass SDK Part type restrictions)
            const rawParts = responseParts as unknown as Array<Record<string, unknown>>;
            const thoughtPart = rawParts.find(
                (p) => 'thought_signature' in p || 'thoughtSignature' in p
            );
            const newSignature = thoughtPart
                ? (thoughtPart.thought_signature || thoughtPart.thoughtSignature) as string | undefined
                : undefined;

            logger.info(`[DirectImageEditor] ✅ Edit complete (${useHighFidelity ? 'Pro' : 'Flash'}).`);

            return {
                id: crypto.randomUUID(),
                url,
                prompt: `Edit (${useHighFidelity ? 'Pro' : 'Flash'}): ${options.prompt}`,
                thoughtSignature: newSignature
            };
        }

        // Check for text-only response (likely safety block)
        const textPart = responseParts.find(p => 'text' in p);
        if (textPart && 'text' in textPart && typeof textPart.text === 'string') {
            logger.warn('[DirectImageEditor] Received text instead of image (likely safety block):', textPart.text);
        }

        return null;

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
