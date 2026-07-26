import { logger } from '@/utils/logger';
import { withServiceError } from '@/lib/errors';
import { functionsWest1 as functions, auth, storage } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS, INTELLIGENCE_CONFIG } from '@/core/config/intelligence-models';
import { getImageConstraints, getDistributorPromptContext, type ImageConstraints } from '@/services/onboarding/DistributorContext';
import type { UserProfile } from '@/modules/workflow/types';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import type { SubscriptionTier } from '@/services/subscription/types';
import { usageTracker } from '@/services/subscription/UsageTracker';
import { QuotaExceededError } from '@/shared/types/errors';
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';
import { CostControlService } from '@/services/billing/CostControlService';
import { normalizeEditImageResult } from './editResponse';
import { fetchAsBase64 } from '@/services/storage/safeStorageFetch';
// ============================================================================
// TYPES
// ============================================================================

/**
 * Nano Banana model tier selector.
 * Maps to the 3-tier backend model registry.
 */
export type NanoBananaTier = 'legacy' | 'lite' | 'fast' | 'pro';

/**
 * Full image generation options.
 * All fields are passed through to the Cloud Function without stripping.
 */
export interface ImageGenerationOptions {
    prompt: string;
    count?: number;
    aspectRatio?: string;
    resolution?: string; // Mapped to imageSize for backend compat
    negativePrompt?: string;
    /** Person generation policy: ALLOW_ALL | ALLOW_ADULT | ALLOW_NONE */
    personGeneration?: string;
    sourceImages?: { mimeType: string; data: string }[]; // Reference images for composition
    /** Already-uploaded references for callers that own the storage handoff. */
    referenceUris?: string[];
    referenceImages?: {
        image: { uri?: string; imageBytes?: string; mimeType?: string };
        referenceType: 'asset' | 'person' | 'face' | 'style' | 'subject'; // Allow likeness tuning for Face Swap
    }[];
    projectContext?: string;

    // Distributor-aware options
    userProfile?: UserProfile;
    isCoverArt?: boolean; // If true, enforces distributor cover art specs

    // Gemini 3 advanced parameters
    model?: NanoBananaTier | 'imagen-4.0-ultra-generate-001' | 'imagen-4.0-generate-001' | 'imagen-4.0-fast-generate-001' | string;

    // --- Gemini 3 Advanced Configuration ---

    /** Output resolution: "512" | "1k" | "2k" | "4k" */
    imageSize?: '512' | '1k' | '2k' | '4k';

    /** Thinking level (Flash only — Pro always thinks). */
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';

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

    /** Optional creative session id used to link jobs back to the editor/session record. */
    sessionId?: string;

    /** Optional artistic style directive. */
    style?: string;
    /** Optional generation quality setting. */
    quality?: string;
    /** Random seed for reproducible generation. */
    seed?: string;

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
    /** Immutable backend-produced object identity; `url` is display-only. */
    storageUri?: string;
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

/**
 * ImageGenerationService
 *
 * Client-side service for managing Nano Banana image generation workflows.
 * Orchestrates calls to Firebase Cloud Functions and handles
 * distributor-aware prompt injection and quota pre-flights.
 */
export class ImageGenerationService {
    private readonly inFlightGenerations = new Map<string, Promise<ImageGenerationResult[]>>();

    private generationKey(options: ImageGenerationOptions): string {
        // Deliberately includes the creative inputs which affect provider output;
        // two concurrent clicks for the same request share one reservation/job.
        return JSON.stringify({
            userId: auth.currentUser?.uid,
            prompt: options.prompt,
            count: options.count ?? 1,
            aspectRatio: options.aspectRatio,
            resolution: options.resolution,
            imageSize: options.imageSize,
            model: options.model,
            thinkingLevel: options.thinkingLevel,
            includeThoughts: options.includeThoughts,
            useGoogleSearch: options.useGoogleSearch,
            useImageSearch: options.useImageSearch,
            responseFormat: options.responseFormat,
            seed: options.seed,
            sessionId: options.sessionId,
            sourceImages: options.sourceImages,
            referenceUris: options.referenceUris,
            referenceImages: options.referenceImages,
        });
    }


    /**
     * Retrieves architectural constraints for image generation based on user's distributor.
     * 
     * @param profile - The active user profile.
     * @returns Object containing width, height, and color mode requirements.
     */
    getDistributorConstraints(profile: UserProfile): ImageConstraints {
        return getImageConstraints(profile);
    }

    /**
     * Constructs a final prompt string by injecting distributor requirements and project context.
     * 
     * @param options - Generation options containing prompt and context.
     * @returns Fully qualified prompt string for the model.
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
     * Resolves the target aspect ratio, defaulting to 1:1 square for cover art.
     * 
     * @param options - Generation options.
     * @returns Aspect ratio string (e.g., "16:9").
     */
    private getAspectRatio(options: ImageGenerationOptions): string {
        if (options.isCoverArt) {
            return '1:1';
        }
        return options.aspectRatio || '1:1';
    }

    /**
     * Maps video-style resolution strings to Gemini image API values.
     * The studioControls store uses VideoResolution ('720p', '1080p', '4k')
     * but the image API expects '512' | '1K' | '2K' | '4K'.
     */
    private normalizeImageResolution(resolution?: string): string | undefined {
        if (!resolution) return undefined;

        const RESOLUTION_MAP: Record<string, string> = {
            '720p':  '1k',
            '1080p': '2k',
            '4k':    '4k',
            // Direct passthrough for already-correct values
            '512':   '512',
            '1k':    '1k',
            '1K':    '1k',
            '2k':    '2k',
            '2K':    '2k',
            '4K':    '4k',
        };

        const mapped = RESOLUTION_MAP[resolution] || RESOLUTION_MAP[resolution.toLowerCase()];
        if (!mapped) {
            logger.warn(`[ImageGen] Unknown resolution "${resolution}", defaulting to 1k`);
            return '1k';
        }
        return mapped;
    }

    private async resolveGeneratedAssetUrl(uri: string): Promise<string> {
        if (!uri.startsWith('gs://')) {
            return uri;
        }

        try {
            return await getDownloadURL(storageRef(storage, uri));
        } catch (error: unknown) {
            logger.warn('[ImageGen] Failed to resolve Storage URI to download URL:', error);
            return uri;
        }
    }

    private async loadImageFromUri(uri: string): Promise<{ mimeType: string; data: string }> {
        const { base64, mimeType } = await fetchAsBase64(uri);
        return { mimeType, data: base64 };
    }

    /**
     * Triggers the image generation pipeline via Cloud Functions.
     * Performs authentication pre-flights and quota checks.
     * 
     * @param options - Full configuration for the Generation API.
     * @returns A promise resolving to an array of generated image results.
     * @throws {Error} If session is unauthenticated or expired.
     * @throws {QuotaExceededError} If usage limits are reached.
     */
    async generateImages(options: ImageGenerationOptions): Promise<ImageGenerationResult[]> {
        const key = this.generationKey(options);
        const existing = this.inFlightGenerations.get(key);
        if (existing) return existing;

        const request = this.generateImagesUncached(options).finally(() => {
            this.inFlightGenerations.delete(key);
        });
        this.inFlightGenerations.set(key, request);
        return request;
    }

    private async generateImagesUncached(options: ImageGenerationOptions): Promise<ImageGenerationResult[]> {
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

        // Cost Control: Enforce budget limits before expensive API call
        const estimatedCost = count * 0.04; // $0.04 per image
        const uid = userId || auth.currentUser.uid;
        const costCheck = await CostControlService.checkAndReserve({
            operationType: 'image',
            estimatedCost,
            userId: uid,
            metadata: {
                imageCount: count,
                prompt: options.prompt.substring(0, 100),
                style: options.style,
            },
        });

        if (!costCheck.allowed) {
            const isInfraFailure = costCheck.reason?.includes('unavailable') || costCheck.reason?.includes('permission/auth check failed');

            if (isInfraFailure) {
                // ISSUE-881: FAIL CLOSED. A cost-ledger outage must not turn paid
                // image generation into unmetered generation — the backend callable
                // has no reservation requirement of its own to catch this.
                logger.error('[ImageGenerationService] Cost ledger unavailable — blocking generation (fail-closed).', { reason: costCheck.reason });
                throw new Error(
                    'Image generation is temporarily unavailable: the cost-control service could not verify your budget. Please try again in a moment.'
                );
            } else if (costCheck.requiresConfirmation) {
                const approved = await new Promise<boolean>((resolve) => {
                    import('@/core/store').then(({ useStore }) => {
                        useStore.getState().setPendingCostWarning({
                            estimatedCost,
                            reason: costCheck.reason || 'This operation is expensive.',
                            resolve
                        });
                    });
                });

                if (!approved) {
                    throw new Error('Image generation cancelled by user (cost too high)');
                }

                throw new Error(
                    'Image generation requires a server-side approval for this cost. Reduce the request or wait for an approved budget flow.'
                );
            } else {
                throw new Error(`Image generation blocked: ${costCheck.reason}`);
            }
        }
        if (!costCheck.operationId) {
            throw new Error('Image generation blocked: cost reservation receipt is missing.');
        }

        try {
            const generateImage = httpsCallable(functions, 'generateImageV3');
            logger.debug('[ImageGen DEBUG] Calling generateImageV3');

            let fullPrompt = this.buildDistributorAwarePrompt(options);

            // Enhance prompt with headshot instruction if user headshots are included
            if (options.userProfile?.brandKit?.referenceImages?.some(a => a.category === 'headshot')) {
                fullPrompt += ' [Reference headshots provided: Use them as a visual likeness guide. Match facial features, appearance, ethnicity, and distinctive characteristics of the person in the reference images.]';
            }

            const aspectRatio = this.getAspectRatio(options);

            // Resolve imageSize: prefer explicit imageSize, fall back to resolution.
            const imageSize = options.imageSize || this.normalizeImageResolution(options.resolution);

            let referenceUris = options.referenceUris?.slice(0, 14);
            const allReferenceImages: { mimeType: string; data: string }[] = [...(options.sourceImages || [])];

            // Auto-inject user's stored headshots from profile
            if (options.userProfile?.brandKit?.referenceImages?.length) {
                const headshotAssets = options.userProfile.brandKit.referenceImages.filter(
                    (asset) => asset.category === 'headshot'
                );

                if (headshotAssets.length > 0) {
                    logger.debug(`[ImageGen] Found ${headshotAssets.length} user headshots, attempting to load`);

                    const loadedHeadshots = await Promise.all(
                        headshotAssets.map(async (asset) => {
                            try {
                                const img = await this.loadImageFromUri(asset.url);
                                logger.debug(`[ImageGen] Successfully loaded headshot: ${asset.id}`);
                                return img;
                            } catch (e) {
                                logger.warn(`[ImageGen] Failed to load headshot ${asset.id}:`, e);
                                return null;
                            }
                        })
                    );

                    const validHeadshots = loadedHeadshots.filter((img): img is { mimeType: string; data: string } => img !== null);
                    allReferenceImages.push(...validHeadshots);
                    logger.debug(`[ImageGen] Injected ${validHeadshots.length} user headshots as reference images`);
                }
            }

            if (allReferenceImages.length > 0) {
                const uploadedReferenceUris = (await Promise.all(
                    allReferenceImages.slice(0, 14).map((img) =>
                        CreativeStorageService.uploadReferenceMedia(uid, `data:${img.mimeType};base64,${img.data}`, 'image', { scope: 'objects' })
                    )
                )).filter((uri): uri is string => !!uri);
                referenceUris = [...(referenceUris ?? []), ...uploadedReferenceUris]
                    .filter((uri, index, all) => all.indexOf(uri) === index)
                    .slice(0, 14);
            }
            const referenceUri = referenceUris?.[0];

            const payload: Record<string, unknown> = {
                prompt: fullPrompt,
                aspectRatio,
                count,
                model: options.model || 'fast',
                imageSize,
                referenceUri,
                referenceUris,
                costReservationId: costCheck.operationId,
                // Gemini 3 advanced config
                thinkingLevel: options.thinkingLevel,
                includeThoughts: options.includeThoughts,
                useGoogleSearch: options.useGoogleSearch,
                useImageSearch: options.useImageSearch,
                responseFormat: options.responseFormat,
                // Multi-turn
                conversationHistory: options.conversationHistory,
                thoughtSignature: options.thoughtSignature,
                sessionId: options.sessionId,
                // Advanced control
                style: options.style,
                quality: options.quality,
                seed: options.seed,
                // Legacy compat
                thinking: options.thinking,
                useGrounding: options.useGrounding,
                // Person generation safety filter
                personGeneration: options.personGeneration,
                referenceImages: options.referenceImages,
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
                hasReferenceUri: !!referenceUri,
                hasThinking: !!payload.thinkingLevel,
                hasGrounding: !!payload.useGoogleSearch,
                hasHistory: !!(payload.conversationHistory as unknown[])?.length,
            });

            const result = await generateImage(payload);
            logger.debug('[ImageGen DEBUG] generateImageV3 returned:', result);

            interface GenerateImageResponse {
                images?: Array<{
                    bytesBase64Encoded?: string;
                    mimeType?: string;
                }>;
                jobId?: string;
                resultUri?: string;
                resultUrl?: string;
                resultUris?: string[];
                textNarration?: string;
                thoughtSignature?: string;
                thoughtSummary?: string;
                groundingMetadata?: Record<string, unknown>;
            }
            const data = result.data as GenerateImageResponse;

            // New gateway contract: image is already saved in Cloud Storage.
            const generatedUris = data.resultUris?.length
                ? data.resultUris
                : [data.resultUrl || data.resultUri].filter((uri): uri is string => !!uri);
            if (generatedUris.length > 0) {
                const storedResults = await Promise.all(generatedUris.map(async (generatedUri, index) => ({
                    id: index === 0 && data.jobId ? data.jobId : `${data.jobId || crypto.randomUUID()}_${index + 1}`,
                    url: await this.resolveGeneratedAssetUrl(generatedUri),
                    storageUri: generatedUri,
                    prompt: options.prompt,
                    textNarration: data.textNarration,
                    thoughtSignature: data.thoughtSignature || data.thoughtSummary,
                    groundingMetadata: data.groundingMetadata,
                })));
                results.push(...storedResults);
            }

            // Cloud Function returns { images: [...], textNarration?, thoughtSignature?, groundingMetadata? }
            if (!data.images || data.images.length === 0) {
                return results;
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
            // The request may have reached the gateway even when this client
            // observes a network failure. Only the backend knows whether
            // generation started, so it alone may settle or void a hold.
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
                    resolution: options.resolution || '1k',
                    imageSize: options.imageSize || '1k',
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
            const { functions } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');
            const editImageFn = httpsCallable(functions, 'editImage');

            logger.info('[ImageGen] remixImage: using secured backend path', {
                hasContent: !!options.contentImage,
                hasStyle: !!options.styleImage,
                promptSnippet: (options.prompt || '').substring(0, 60),
            });

            const result = await editImageFn({
                image: {
                    mimeType: options.contentImage.mimeType,
                    data: options.contentImage.data,
                },
                referenceImage: options.styleImage ? {
                    mimeType: options.styleImage.mimeType,
                    data: options.styleImage.data,
                } : undefined,
                prompt: options.prompt || 'Remix this image',
                model: 'pro'
            });

            const data = normalizeEditImageResult(result.data, options.prompt || 'Remix this image');
            if (!data?.url) return null;

            return { url: data.url };
        });
    }

    async extractStyle(image: { mimeType: string; data: string }): Promise<{ prompt_desc?: string, style_context?: string, negative_prompt?: string }> {
        return withServiceError('ImageGeneration', 'extractStyle', async () => {
            const response = await AutonomousIntelligence.generateContent(
                [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: image.mimeType, data: image.data } },
                        { text: `Analyze this image. Return JSON: { "prompt_desc": "Visual description", "style_context": "Artistic style, camera, lighting tags", "negative_prompt": "What to avoid" }` }
                    ]
                }],
                INTELLIGENCE_MODELS.TEXT.FAST,
                {
                    responseMimeType: 'application/json',
                    ...INTELLIGENCE_CONFIG.THINKING.LOW
                }
            );

            return AutonomousIntelligence.parseJSON(response.response.text());
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

                    const [result] = await this.generateImages({
                        prompt: `Render this content image in the artistic style of the reference image. Maintain the composition and subject from content, apply colors, textures, and mood from style. ${options.prompt || 'Restyle'}`,
                        count: 1,
                        aspectRatio,
                        // The canonical service uploads these transient bytes to
                        // owner-scoped Storage before the backend accepts them.
                        sourceImages: [
                            { mimeType: target.mimeType, data: target.data },
                            { mimeType: options.styleImage.mimeType, data: options.styleImage.data },
                        ],
                    });
                    return result
                        ? { ...result, prompt: `Batch Style: ${options.prompt || 'Restyle'}` }
                        : null;
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
            // ── Auth Pre-Flight ────────────────────────────────────────────────
            if (!auth.currentUser) {
                logger.error('[ImageGen] No authenticated user — cannot call Cloud Function.');
                throw new Error('Your session has expired. Please sign in again.');
            }

            try {
                await auth.currentUser.getIdToken(true);
            } catch (tokenError: unknown) {
                logger.error('[ImageGen] Failed to refresh auth token:', tokenError);
                throw new Error('Your authentication session could not be refreshed. Please sign out and sign back in.');
            }

            const editImageFn = httpsCallable(functions, 'editImage');
            const result = await editImageFn(options);
            return normalizeEditImageResult(result.data, options.prompt);
        });
    }

    /**
     * Extracts the "essence" of an image using a Vision LLM.
     * Used by the Whisk pipeline for Subject, Scene, and Style locking.
     */
    async captionImage(image: { mimeType: string, data: string }, category: 'subject' | 'scene' | 'style'): Promise<string> {
        return withServiceError('ImageGeneration', `captionImage(${category})`, async () => {
            const promptMap = {
                subject: "Describe the primary subject of this image in detail. Focus on appearance, clothing, ethnicity, hair, and notable features. Keep it descriptive for an Intelligence image generator.",
                scene: "Describe the setting, environment, and background of this image. Focus on location, objects, architecture, and spatial arrangement.",
                style: "Describe the artistic style, lighting, mood, color palette, and camera technique of this image. Focus on the visual 'vibe' rather than the content."
            };

            const response = await AutonomousIntelligence.generateContent(
                [{
                    role: 'user',
                    parts: [
                        { text: promptMap[category] },
                        { inlineData: { mimeType: image.mimeType || 'image/png', data: image.data } }
                    ]
                }],
                INTELLIGENCE_MODELS.TEXT.FAST,
                {
                    ...INTELLIGENCE_CONFIG.THINKING.LOW
                }
            );
            return response.response.text().trim();
        }, 'Visual reference');
    }
}

export const ImageGeneration = new ImageGenerationService();
