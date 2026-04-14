import { logger } from '@/utils/logger';
import { withServiceError } from '@/lib/errors';
import { functionsWest1 as functions, auth } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { firebaseAI } from '../ai/FirebaseAIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { getImageConstraints, getDistributorPromptContext, type ImageConstraints } from '@/services/onboarding/DistributorContext';
import type { UserProfile } from '@/modules/workflow/types';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import type { SubscriptionTier } from '@/services/subscription/types';
import { usageTracker } from '@/services/subscription/UsageTracker';
import { QuotaExceededError } from '@/shared/types/errors';
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Nano Banana model tier selector.
 * Maps to the 3-tier backend model registry.
 */
export type NanoBananaTier = 'legacy' | 'fast' | 'pro';

/**
 * Full image generation options.
 * All fields are passed through to the Cloud Function without stripping.
 */
export interface ImageGenerationOptions {
    prompt: string;
    count?: number;
    aspectRatio?: string;
    resolution?: string; // Mapped to imageSize for backend compat
    seed?: number;
    negativePrompt?: string;
    sourceImages?: { mimeType: string; data: string }[]; // Reference images for composition
    projectContext?: string;

    // Distributor-aware options
    userProfile?: UserProfile;
    isCoverArt?: boolean; // If true, enforces distributor cover art specs

    // Nano Banana Model Tier
    model?: NanoBananaTier;

    // --- Gemini 3 Advanced Configuration ---

    /** Output resolution: "512" | "1K" | "2K" | "4K" (uppercase required by API) */
    imageSize?: '512' | '1K' | '2K' | '4K';

    /** Thinking level (Flash only — Pro always thinks). "minimal" or "high". */
    thinkingLevel?: 'minimal' | 'high';

    /** Whether to include thinking process in the response. */
    includeThoughts?: boolean;

    /** Enable Google Search grounding — model uses real-time search to inform generation. */
    useGoogleSearch?: boolean;

    /** Enable Image Search grounding (Flash only). Requires useGoogleSearch=true. */
    useImageSearch?: boolean;

    /** Response format: "image_only" (default) | "image_and_text" (interleaved narration). */
    responseFormat?: 'image_only' | 'image_and_text';

    /** Previous conversation history for multi-turn editing sessions. */
    conversationHistory?: { role: string; parts: Record<string, unknown>[] }[];

    /** Thought signature from a previous response for multi-turn continuity. */
    thoughtSignature?: string;

    // --- Legacy compat (deprecated) ---

    /** @deprecated Use `thinkingLevel` instead. */
    thinking?: boolean;
    /** @deprecated Use `useGoogleSearch` instead. */
    useGrounding?: boolean;
}

/**
 * Extended generation result including Gemini 3 metadata.
 */
export interface ImageGenerationResult {
    id: string;
    url: string;
    prompt: string;
    textNarration?: string;
    thoughtSignature?: string;
    groundingMetadata?: Record<string, unknown>;
}

export interface RemixOptions {
    contentImage: { mimeType: string; data: string };
    styleImage: { mimeType: string; data: string };
    prompt?: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export class ImageGenerationService {

    /**
     * Get distributor-aware image constraints.
     * Returns the image specs required by the user's distributor.
     */
    getDistributorConstraints(profile: UserProfile): ImageConstraints {
        return getImageConstraints(profile);
    }

    /**
     * Build a distributor-aware prompt that includes sizing requirements.
     */
    private buildDistributorAwarePrompt(options: ImageGenerationOptions): string {
        let prompt = options.prompt;

        // If cover art mode and profile is provided, inject distributor context
        if (options.isCoverArt && options.userProfile) {
            const constraints = getImageConstraints(options.userProfile);
            const distributorContext = getDistributorPromptContext(options.userProfile);

            // Prepend distributor requirements to ensure proper sizing
            prompt = `[COVER ART REQUIREMENTS: Generate a ${constraints.width}x${constraints.height}px square image.${constraints.colorMode} color mode only.]\n\n${prompt}`;

            // Add project context if not already provided
            if (!options.projectContext) {
                options.projectContext = `\n\n${distributorContext}`;
            }
        }

        return prompt + (options.projectContext || '') + (options.negativePrompt ? ` --negative_prompt: ${options.negativePrompt}` : '');
    }

    /**
     * Get the appropriate aspect ratio for the request.
     */
    private getAspectRatio(options: ImageGenerationOptions): string {
        // If cover art mode, always use 1:1 square
        if (options.isCoverArt) {
            return '1:1';
        }
        return options.aspectRatio || '1:1';
    }

    /**
     * Generate images using the Nano Banana Cloud Function.
     *
     * ALL configuration parameters are passed through to the backend.
     * No parameter stripping — the backend Cloud Function handles validation
     * and capability gating per model tier.
     */
    async generateImages(options: ImageGenerationOptions): Promise<ImageGenerationResult[]> {
        logger.debug('[ImageGen DEBUG] Entering generateImages', options);
        const results: ImageGenerationResult[] = [];
        const count = options.count || 1;

        // ── Auth Pre-Flight ────────────────────────────────────────────────
        // Verify the user has a valid, non-expired auth session BEFORE
        // calling the Cloud Function. This catches stale sessions early
        // and returns a clear error instead of cryptic 401 gRPC failures.
        if (!auth.currentUser) {
            logger.error('[ImageGen] No authenticated user — cannot call Cloud Function.');
            throw new Error(
                'Your session has expired. Please sign in again to generate images. ' +
                '(Go to Settings → Account, or refresh the page.)'
            );
        }

        try {
            // Force-refresh the ID token to catch expired refresh tokens
            await auth.currentUser.getIdToken(/* forceRefresh */ true);
            logger.debug('[ImageGen] Auth token refreshed successfully.');
        } catch (tokenError: unknown) {
            logger.error('[ImageGen] Failed to refresh auth token:', tokenError);
            throw new Error(
                'Your authentication session could not be refreshed. ' +
                'Please sign out and sign back in. (Settings → Account)'
            );
        }

        // Pre-flight quota check
        const userId = options.userProfile?.id;
        const quotaCheck = await subscriptionService.canPerformAction('generateImage', count, userId);
        logger.debug('[ImageGen DEBUG] Quota check result:', quotaCheck);

        if (!quotaCheck.allowed) {
            logger.error('[ImageGen] Quota exceeded');
            let tier: SubscriptionTier = 'free' as SubscriptionTier;
            try {
                const sub = userId
                    ? await subscriptionService.getSubscription(userId)
                    : await subscriptionService.getCurrentSubscription();
                tier = sub.tier;
            } catch (e: unknown) {
                logger.warn('Failed to fetch tier for QuotaExceededError, defaulting to free', e);
            }

            throw new QuotaExceededError(
                'images',
                tier,
                quotaCheck.reason || 'Quota exceeded',
                quotaCheck.currentUsage?.used || 0,
                quotaCheck.currentUsage?.limit || count
            );
        }

        try {
            const generateImage = httpsCallable(functions, 'generateImageV3');
            logger.debug('[ImageGen DEBUG] Calling generateImageV3');

            const fullPrompt = this.buildDistributorAwarePrompt(options);
            const aspectRatio = this.getAspectRatio(options);

            // Resolve imageSize: prefer explicit imageSize, fall back to resolution (legacy)
            const imageSize = options.imageSize || (options.resolution ? options.resolution.toUpperCase() : undefined);

            // Build the full payload — pass ALL config through, no stripping.
            // The backend Cloud Function + capability registry handles validation.
            const payload: Record<string, unknown> = {
                prompt: fullPrompt,
                aspectRatio,
                count,
                model: options.model || 'fast',
                imageSize,
                // Reference images (for multi-image composition)
                images: options.sourceImages,
                // Gemini 3 advanced config
                thinkingLevel: options.thinkingLevel,
                includeThoughts: options.includeThoughts,
                useGoogleSearch: options.useGoogleSearch,
                useImageSearch: options.useImageSearch,
                responseFormat: options.responseFormat,
                // Multi-turn
                conversationHistory: options.conversationHistory,
                thoughtSignature: options.thoughtSignature,
                // Legacy compat
                thinking: options.thinking,
                useGrounding: options.useGrounding,
            };

            // Clean undefined values to reduce payload size
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined || payload[key] === null) {
                    delete payload[key];
                }
            });

            logger.debug('[ImageGen DEBUG] Full payload:', {
                model: payload.model,
                aspectRatio: payload.aspectRatio,
                imageSize: payload.imageSize,
                hasImages: !!(payload.images as unknown[])?.length,
                hasThinking: !!payload.thinkingLevel,
                hasGrounding: !!payload.useGoogleSearch,
                hasHistory: !!(payload.conversationHistory as unknown[])?.length,
            });

            const result = await generateImage(payload);
            logger.debug('[ImageGen DEBUG] generateImageV3 returned:', result);

            interface GenerateImageResponse {
                images: Array<{
                    bytesBase64Encoded?: string;
                    mimeType?: string;
                }>;
                textNarration?: string;
                thoughtSignature?: string;
                groundingMetadata?: Record<string, unknown>;
            }
            const data = result.data as GenerateImageResponse;

            // Cloud Function returns { images: [...], textNarration?, thoughtSignature?, groundingMetadata? }
            if (!data.images || data.images.length === 0) {
                return [];
            }

            // Parallelize image processing and uploading
            const promises = data.images.map(async (img) => {
                if (!img.bytesBase64Encoded) return null;

                const mimeType = img.mimeType || 'image/png';
                const dataUri = `data:${mimeType};base64,${img.bytesBase64Encoded}`;
                const id = crypto.randomUUID();

                let finalUrl = dataUri;

                try {
                    const { useStore } = await import('@/core/store');
                    const storeUserId = useStore.getState().userProfile?.id;

                    if (storeUserId) {
                        const { CloudStorageService } = await import('@/services/CloudStorageService');
                        const saved = await CloudStorageService.smartSave(dataUri, id, storeUserId);
                        finalUrl = saved.url;
                    } else {
                        // Force compression if not uploading, to respect Firestore 1MB limit
                        const { CloudStorageService } = await import('@/services/CloudStorageService');
                        const compressed = await CloudStorageService.compressImage(dataUri, {
                            maxWidth: 512,
                            maxHeight: 512,
                            quality: 0.6
                        });
                        finalUrl = compressed.dataUri;
                    }
                } catch (e: unknown) {
                    logger.warn('Failed to upload to cloud storage, falling back to compressed data URI:', e);
                    try {
                        const { CloudStorageService } = await import('@/services/CloudStorageService');
                        const compressed = await CloudStorageService.compressImage(dataUri, {
                            maxWidth: 512,
                            maxHeight: 512,
                            quality: 0.6
                        });
                        finalUrl = compressed.dataUri;
                    } catch (compressionError: unknown) {
                        logger.warn('Compression failed, using original size:', compressionError);
                    }
                }

                return {
                    id,
                    url: finalUrl,
                    prompt: options.prompt,
                    textNarration: data.textNarration,
                    thoughtSignature: data.thoughtSignature,
                    groundingMetadata: data.groundingMetadata,
                } as ImageGenerationResult;
            });

            const parallelResults = await Promise.all(promises);
            parallelResults.forEach(res => {
                if (res) results.push(res);
            });

            if (results.length > 0 && typeof window !== 'undefined' && window.electronAPI) {
                window.electronAPI.showNotification(
                    'Studio Generation Complete',
                    `Successfully generated ${results.length} image${results.length > 1 ? 's' : ''}.`
                );
            }
        } catch (err: unknown) {
            const errObj = err as { code?: string; details?: unknown };
            const errorMsg = err instanceof Error ? err.message : String(err);
            logger.error('Image Generation Error', {
                message: errorMsg,
                code: errObj.code,
                details: errObj.details,
            });

            if (typeof window !== 'undefined' && window.electronAPI) {
                window.electronAPI.showNotification(
                    'Generation Failed',
                    `Image generation error: ${errorMsg}`
                );
            }
            throw err;
        }

        // Track usage after successful generation
        if (results.length > 0) {
            try {
                const { useStore } = await import('@/core/store');
                const trackingUserId = useStore.getState().userProfile?.id;
                if (trackingUserId) {
                    await usageTracker.trackImageGeneration(trackingUserId, results.length, {
                        prompt: options.prompt,
                        aspectRatio: options.aspectRatio,
                        resolution: options.resolution,
                        model: options.model,
                        tier: options.model || 'fast',
                    });
                }
            } catch (_e: unknown) {
                // Usage tracking failure should not block generation
            }

            // Persist image metadata to Firestore for future retrieval
            for (const image of results) {
                metadataPersistenceService.save('image', {
                    prompt: options.prompt,
                    aspectRatio: options.aspectRatio || '1:1',
                    resolution: options.resolution,
                    imageSize: options.imageSize,
                    model: options.model || 'fast',
                    sourceType: 'generation',
                    isCoverArt: options.isCoverArt || false,
                    imageId: image.id,
                    hasDataUri: image.url.startsWith('data:'),
                    hasGrounding: !!options.useGoogleSearch,
                    hasThinking: !!options.thinkingLevel,
                    isMultiTurn: !!(options.conversationHistory && options.conversationHistory.length > 0),
                    generatedAt: new Date().toISOString(),
                }, {
                    showToasts: false,
                    maxRetries: 1,
                    queueOnFailure: true,
                }).catch(err => {
                    logger.warn('[ImageGeneration] Failed to persist image metadata:', err);
                });
            }
        }

        return results;
    }

    /**
     * Generate cover art with automatic distributor compliance.
     * This is the recommended method for generating release artwork.
     */
    async generateCoverArt(
        prompt: string,
        profile: UserProfile,
        options?: Partial<ImageGenerationOptions>
    ): Promise<(ImageGenerationResult & { constraints: ImageConstraints })[]> {
        const constraints = getImageConstraints(profile);

        const results = await this.generateImages({
            ...options,
            prompt,
            userProfile: profile,
            isCoverArt: true,
            aspectRatio: '1:1', // Cover art is always square
        });

        // Attach constraints to results for UI display
        return results.map(r => ({ ...r, constraints }));
    }

    async remixImage(options: RemixOptions): Promise<{ url: string } | null> {
        return withServiceError('ImageGeneration', 'remixImage', async () => {
            const editImageFn = httpsCallable(functions, 'editImage');

            const result = await editImageFn({
                prompt: options.prompt || 'Create a cinematic remix.',
                image: options.contentImage?.data || '',
                imageMimeType: options.contentImage?.mimeType || 'image/png',
                // Pass style image as a reference image for composition
                referenceImages: options.styleImage ? [{
                    mimeType: options.styleImage.mimeType,
                    data: options.styleImage.data,
                }] : undefined,
            });

            const data = result.data as { candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[] };

            if (data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
                const mimeType = data.candidates[0].content.parts[0].inlineData.mimeType || 'image/png';
                const base64 = data.candidates[0].content.parts[0].inlineData.data;
                return { url: `data:${mimeType};base64,${base64}` };
            }
            return null;
        });
    }

    async extractStyle(image: { mimeType: string; data: string }): Promise<{ prompt_desc?: string, style_context?: string, negative_prompt?: string }> {
        return withServiceError('ImageGeneration', 'extractStyle', async () => {
            const response = await firebaseAI.generateContent(
                [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: image.mimeType, data: image.data } },
                        { text: `Analyze this image. Return JSON: { "prompt_desc": "Visual description", "style_context": "Artistic style, camera, lighting tags", "negative_prompt": "What to avoid" }` }
                    ]
                }],
                AI_MODELS.TEXT.FAST,
                {
                    responseMimeType: 'application/json',
                    ...AI_CONFIG.THINKING.LOW
                }
            );

            return firebaseAI.parseJSON(response.response.text());
        });
    }

    /**
     * Batch remix: apply a style to multiple images.
     * Now passes source images through as reference images instead of stripping them.
     */
    async batchRemix(options: {
        styleImage: { mimeType: string; data: string };
        targetImages: { mimeType: string; data: string; width?: number; height?: number }[];
        prompt?: string;
    }): Promise<ImageGenerationResult[]> {
        const results: ImageGenerationResult[] = [];
        const generateImage = httpsCallable(functions, 'generateImageV3');

        try {
            // Parallelize requests
            const promises = options.targetImages.map(async (target) => {
                try {
                    // Determine aspect ratio based on target image dimensions
                    let aspectRatio = '1:1';
                    if (target.width && target.height) {
                        if (target.width > target.height * 1.2) aspectRatio = '16:9';
                        else if (target.height > target.width * 1.2) aspectRatio = '9:16';
                    }

                    const result = await generateImage({
                        prompt: `Render this content image in the artistic style of the reference image. Maintain the composition and subject from content, apply colors, textures, and mood from style. ${options.prompt || 'Restyle'}`,
                        // Pass both images as reference images for the model to compose
                        images: [
                            { mimeType: target.mimeType, data: target.data },
                            { mimeType: options.styleImage.mimeType, data: options.styleImage.data },
                        ],
                        aspectRatio,
                    });

                    interface GenerateImageResponse {
                        images: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
                    }
                    const data = result.data as GenerateImageResponse;

                    if (data.images?.[0]?.bytesBase64Encoded) {
                        const mimeType = data.images[0].mimeType || 'image/png';
                        return {
                            id: crypto.randomUUID(),
                            url: `data:${mimeType};base64,${data.images[0].bytesBase64Encoded}`,
                            prompt: `Batch Style: ${options.prompt || "Restyle"}`,
                        } as ImageGenerationResult;
                    }
                    return null;
                } catch (error: unknown) {
                    logger.error('Individual Batch Remix Error:', error);
                    return null;
                }
            });

            const parallelResults = await Promise.all(promises);
            parallelResults.forEach(res => {
                if (res) results.push(res);
            });
        } catch (e: unknown) {
            logger.error('Batch Remix Error:', e);
            throw e;
        }
        return results;
    }

    /**
     * Edit a single image via the Cloud Function.
     * Passes all options through including new Gemini 3 fields.
     */
    async editImage(options: {
        image: string;
        prompt: string;
        mask?: string;
        referenceImage?: string;
        referenceImages?: { mimeType: string; data: string }[];
        imageMimeType?: string;
        maskMimeType?: string;
        refMimeType?: string;
        aspectRatio?: string;
        imageSize?: string;
        thinkingLevel?: string;
        thoughtSignature?: string;
        conversationHistory?: { role: string; parts: Record<string, unknown>[] }[];
    }): Promise<unknown> {
        return withServiceError('ImageGeneration', 'editImage', async () => {
            const editImageFn = httpsCallable(functions, 'editImage');
            const result = await editImageFn(options);
            return result.data;
        });
    }

    /**
     * Extracts the "essence" of an image using a Vision LLM.
     * Used by the Whisk pipeline for Subject, Scene, and Style locking.
     */
    async captionImage(image: { mimeType: string, data: string }, category: 'subject' | 'scene' | 'style'): Promise<string> {
        return withServiceError('ImageGeneration', `captionImage(${category})`, async () => {
            const promptMap = {
                subject: "Describe the primary subject of this image in detail. Focus on appearance, clothing, ethnicity, hair, and notable features. Keep it descriptive for an AI image generator.",
                scene: "Describe the setting, environment, and background of this image. Focus on location, objects, architecture, and spatial arrangement.",
                style: "Describe the artistic style, lighting, mood, color palette, and camera technique of this image. Focus on the visual 'vibe' rather than the content."
            };

            const response = await firebaseAI.generateContent(
                [{
                    role: 'user',
                    parts: [
                        { text: promptMap[category] },
                        { inlineData: { mimeType: image.mimeType || 'image/png', data: image.data } }
                    ]
                }],
                AI_MODELS.TEXT.FAST,
                {
                    ...AI_CONFIG.THINKING.LOW
                }
            );
            return response.response.text().trim();
        }, 'Visual reference');
    }
}

export const ImageGeneration = new ImageGenerationService();
