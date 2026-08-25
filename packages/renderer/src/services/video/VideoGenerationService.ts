import { INTELLIGENCE_CONFIG, INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { db, auth } from '@/services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { QuotaExceededError } from '@/shared/types/errors';
 
import { CostControlService } from '@/services/billing/CostControlService';
import { UserProfile } from '@/modules/workflow/types';
import { getVideoConstraints } from '../onboarding/DistributorContext';
import { GenerateVideoSchema } from '@indii/shared';
import { VideoGenerationOptionsSchema, VideoGenerationOptions, VideoAspectRatioSchema, DirectorSettingsSchema } from '@/modules/creative/video/schemas';
import { z } from 'zod';
import { InputSanitizer } from '@/services/intelligence/utils/InputSanitizer';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService';
import { VideoJob, VideoSafetyRating } from '@/types/video';
import { logger } from '@/utils/logger';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';
import { neuralCortex, type RenderDirectives } from '@/services/intelligence/NeuralCortexService';
import { COLLECTIONS } from '@/core/config/collections';
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';


type VideoAspectRatio = z.infer<typeof VideoAspectRatioSchema>;

const DEFAULT_VIDEO_MODEL = INTELLIGENCE_MODELS.VIDEO.PRO; // 'veo-3.1-generate-001' (GA)

const VIDEO_MODEL_TIERS = {
    'veo-3.1-lite-generate-001': 'lite',
    'veo-3.1-fast-generate-001': 'fast',
    'veo-3.1-generate-001': 'pro',
} as const;

/** Convert the UI's canonical GA provider IDs into the shared gateway tier. */
export function normalizeVideoModelTier(model?: string): 'lite' | 'fast' | 'pro' {
    if (!model) return 'fast';
    if (model === 'lite' || model === 'fast' || model === 'pro') return model;
    const tier = VIDEO_MODEL_TIERS[model as keyof typeof VIDEO_MODEL_TIERS];
    if (tier) return tier;
    if (model.includes('lite')) return 'lite';
    if (model.includes('pro')) return 'pro';
    return 'fast';
}

/** Normalize arbitrary canvas/UI aspect ratios to Veo-supported video aspect ratios (16:9 or 9:16). */
export function normalizeVideoAspectRatio(aspectRatio?: string): '16:9' | '9:16' {
    if (!aspectRatio) return '16:9';
    if (aspectRatio === '9:16' || aspectRatio === '3:4' || aspectRatio === '2:3' || aspectRatio === '4:5' || aspectRatio === '9:21' || aspectRatio === '10:16') {
        return '9:16';
    }
    return '16:9';
}


/**
 * VideoGenerationService - Client-side orchestrator for Intelligence video production
 * 
 * Handles quota checking, prompt enrichment (cinematography/physics), 
 * temporal context analysis, and triggering both atomic and long-form 
 * Daisychaining video generation via Cloud Functions.
 */
export class VideoGenerationService {
    private async checkVideoQuota(count: number = 1): Promise<{ canGenerate: boolean, reason?: string }> {
        try {
            const quotaCheck = await subscriptionService.canPerformAction('generateVideo', count);
            return {
                canGenerate: quotaCheck.allowed,
                reason: quotaCheck.allowed ? undefined : quotaCheck.reason
            };
        } catch (e: unknown) {
            logger.error('[VideoGeneration] Quota check failed:', e);
            if (import.meta.env.PROD) {
                return { canGenerate: false, reason: 'Service unavailable. Please try again.' };
            }
            // FAIL-SECURE: Block if check fails (safety-first, not fail-open)
            return { canGenerate: false, reason: 'Quota check unavailable. Please try again.' };
        }
    }


    public estimateVideoCost(durationSeconds: number, model?: string): number {
        const actualModel = model || DEFAULT_VIDEO_MODEL;
        let rate = 0.10; // Default/fast rate
        // Match GA and legacy-preview IDs so old saved jobs still price correctly.
        if (actualModel.includes('lite')) {
            rate = 0.05;
        } else if (!actualModel.includes('fast') && /veo-3\.1-generate-(001|preview)/.test(actualModel)) {
            // The pro model id carries no 'pro' marker — it's the bare generate id.
            rate = 0.40;
        }
        return durationSeconds * rate;
    }

    private enrichPrompt(basePrompt: string, settings: { camera?: string, motion?: number, fps?: number, thinkingLevel?: 'none' | 'minimal' | 'low' | 'medium' | 'high' }, userProfile?: UserProfile): string {
        let prompt = basePrompt;

        if (userProfile) {
            const constraints = getVideoConstraints(userProfile);
            if (constraints.canvas) {
                prompt += `. Optimized for Spotify Canvas (${constraints.canvas.resolution}, vertical 9:16). High visual impact loop.`;
            }
        }

        if (settings.camera && settings.camera !== 'Static') {
            prompt += `, cinematic ${settings.camera.toLowerCase()} camera movement`;
        }
        if (settings.motion && settings.motion > 0.8) {
            prompt += `, high dynamic motion`;
        }
        return prompt;
    }

    private determineTargetAspectRatio(options: { aspectRatio?: string, userProfile?: UserProfile }): VideoAspectRatio | undefined {
        // 1. Explicit override takes precedence
        if (options.aspectRatio) return options.aspectRatio as VideoAspectRatio;

        // 2. Fallback to Distributor Constraints
        if (options.userProfile) {
            const constraints = getVideoConstraints(options.userProfile);
            if (constraints.canvas) {
                return constraints.canvas.aspectRatio as VideoAspectRatio;
            }
        }

        return undefined;
    }

    /**
     * Triggers a standard (atomic) video generation job.
     * Enriches the prompt, analyzes temporal context, and calls the
     * secured generateVideoV3 Firebase Cloud Function.
     * Writes results to Firestore for UI subscription compatibility.
     * 
     * @param options - Configuration for the video generation request.
     * @returns A promise resolving to an array containing the job result.
     */
    async generateVideo(options: VideoGenerationOptions): Promise<{ id: string, url: string, prompt: string }[]> {
        // Zod Validation
        const validation = VideoGenerationOptionsSchema.safeParse(options);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Invalid video parameters: ${errorMsg}`);
        }
        // Normalize before quota/cost reservation. A retired preview model must
        // never reserve spend and a canonical GA ID must not later fail the
        // shared gateway schema that accepts only tier names.
        const modelTier = normalizeVideoModelTier(options.model);

        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error("You must be signed in to generate video. Please log in.");
        }
        const userId = currentUser.uid;

        const quotaCheck = await this.checkVideoQuota();
        if (!quotaCheck.canGenerate) {
            const tierInfo = await subscriptionService.getCurrentSubscription();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            throw new QuotaExceededError('video_duration', tierInfo.tier as any, quotaCheck.reason || 'Limit reached', 1, 1);
        }

        const videoDuration = options.durationSeconds || options.duration || 8;
        const estimatedCost = this.estimateVideoCost(videoDuration, modelTier);
        let costReservationId: string | undefined;
        if (!options.costReservationId) {
            const costCheck = await CostControlService.checkAndReserve({
                operationType: 'video',
                estimatedCost,
                userId,
                metadata: {
                    durationSeconds: videoDuration,
                    model: modelTier,
                    resolution: options.resolution,
                    aspectRatio: options.aspectRatio,
                    mode: options.mode || 'video_remix',
                    sourceVideoUri: options.sourceVideoUri,
                    maskFrameUri: options.maskFrameUri,
                    maskTrackUri: options.maskTrackUri,
                },
            });

            if (!costCheck.allowed) {
                if (costCheck.requiresConfirmation) {
                    // Video has no interactive confirmation prompt (the
                    // conductor cannot click through a dialog), so surface a
                    // clear, actionable block instead of an opaque denial.
                    throw new Error(
                        `Video generation requires a cost confirmation for this request (estimated $${estimatedCost.toFixed(2)}). ` +
                        'Reduce the duration, or contact support to raise the automatic approval limit for your tier.',
                    );
                }
                throw new Error(`Video generation blocked: ${costCheck.reason}`);
            }

            costReservationId = costCheck.operationId;
        }
        const effectiveCostReservationId = options.costReservationId || costReservationId;
        if (!effectiveCostReservationId?.trim()) {
            throw new Error('Video generation blocked: the cost authority did not return a valid reservation ID.');
        }
        const ownsUnclaimedReservation = !options.costReservationId && costReservationId === effectiveCostReservationId;

        try {
            logger.info('[VideoGeneration] 🎬 generateVideo() called (via Gateway):', {
                promptPreview: options.prompt.substring(0, 100),
                userId,
            });

        // Google Search Grounding Pre-flight: Imagen 4 grounding generation used as firstFrame
        let groundingFirstFrame = options.firstFrame;
        if (options.useGrounding && !groundingFirstFrame) {
            logger.info('[VideoGeneration] 🌍 Google Search Grounding enabled. Running pre-flight Imagen 4 generation...');
            try {
                const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
                const imageResults = await ImageGeneration.generateImages({
                    prompt: options.prompt,
                    count: 1,
                    aspectRatio: options.aspectRatio === '9:16' ? '9:16' : options.aspectRatio === '1:1' ? '1:1' : '16:9',
                    useGoogleSearch: true,
                    model: 'imagen-4.0-generate-001' // Imagen 4 Grounded Image Gen
                });
                if (imageResults && imageResults.length > 0) {
                    groundingFirstFrame = imageResults[0].url;
                    logger.info('[VideoGeneration] 🌍 Grounded image generated successfully:', groundingFirstFrame);
                } else {
                    logger.warn('[VideoGeneration] 🌍 Grounding pre-flight did not return any image. Continuing without grounded firstFrame.');
                }
            } catch (imageErr: unknown) {
                logger.error('[VideoGeneration] 🌍 Grounding pre-flight image generation failed:', imageErr);
            }
        }

        // Upload first frame if present
        let firstFrameUri;
        if (groundingFirstFrame) {
            // groundingFirstFrame is a base64, data URI, or URL. Upload it to get a gs:// URI.
            firstFrameUri = await CreativeStorageService.uploadReferenceMedia(userId, groundingFirstFrame, 'image');
        } else if (options.image && options.image.imageBytes) {
            // handle the old imageBytes format just in case
            const b64 = options.image.imageBytes;
            const mime = options.image.mimeType || 'image/jpeg';
            firstFrameUri = await CreativeStorageService.uploadReferenceMedia(userId, `data:${mime};base64,${b64}`, 'image');
        }

        // Upload last frame if present
        let lastFrameUri;
        if (options.lastFrame) {
            lastFrameUri = await CreativeStorageService.uploadReferenceMedia(userId, options.lastFrame, 'image');
        }

        // Upload reference images if present
        let referenceUris;
        if (options.referenceImages && options.referenceImages.length > 0) {
            referenceUris = await Promise.all(
                options.referenceImages.map(async (ref) => {
                    const url = ref.image?.uri || ref.image?.imageBytes;
                    if (url) {
                        return CreativeStorageService.uploadReferenceMedia(userId, url, 'image');
                    }
                    return '';
                })
            );
            referenceUris = referenceUris.filter(Boolean);
        }

        const durationSec = options.duration || options.durationSeconds;
        const clampedDuration = durationSec ? Math.min(8, Math.max(4, durationSec)) : undefined;
        const fps = options.fps ?? 24;
        const directorDuration = clampedDuration ?? durationSec ?? 6;
        // ISSUE-1379: never let aspectRatio/resolution reach serialization as
        // undefined/null — zod's .default()/.optional() reject null (observed
        // live: the agent's generate_video tool omits them and the gateway
        // rejected 'directorSettings.aspectRatio: Expected 16:9|9:16|1:1,
        // received null'). Default here so every caller (tool, studio, API)
        // sends a valid shape.
        const effectiveAspectRatio = options.aspectRatio ?? '16:9';
        const effectiveResolution = options.resolution ?? '720p';
        const directorSettings = DirectorSettingsSchema.parse({
            fps,
            durationSeconds: directorDuration,
            totalFrames: Math.round(directorDuration * fps),
            aspectRatio: effectiveAspectRatio,
            resolution: effectiveResolution,
            seed: options.seed,
            firstFrameUri,
            lastFrameUri,
            cameraMovement: options.cameraMovement,
            motionStrength: options.motionStrength,
        });
        // ISSUE-1379: never ship undefined settings — JSON has no undefined,
        // and the callable SDK can serialize absent values as null. Strip
        // them so only real values leave the client.
        const cleanDirectorSettings = Object.fromEntries(
            Object.entries(directorSettings).filter(([, v]) => v !== undefined && v !== null)
        );
        const referenceRoles = options.inputManifest?.filter(input => ['ingredient', 'character_reference', 'whisk_reference'].includes(input.role)) ?? [];
        const inputManifest = [
            ...(firstFrameUri ? [{ role: 'first_frame' as const, uri: firstFrameUri }] : []),
            ...(lastFrameUri ? [{ role: 'last_frame' as const, uri: lastFrameUri }] : []),
            ...(referenceUris ?? []).map((uri, index) => ({ role: referenceRoles[index]?.role ?? 'ingredient' as const, uri })),
        ];

        const sanitizedPrompt = InputSanitizer.sanitize(options.prompt);
        const enrichedPrompt = this.enrichPrompt(sanitizedPrompt, {
            camera: options.cameraMovement,
            motion: options.motionStrength,
            fps: options.fps,
            thinkingLevel: options.thinkingLevel
        }, options.userProfile);

            const generateVideoV3 = httpsCallable(functions, 'generateVideoV3');
            
            const payload = {
                mode: options.mode,
                prompt: enrichedPrompt,
                firstFrameUri,
                lastFrameUri,
                sourceVideoUri: options.sourceVideoUri,
                maskFrameUri: options.maskFrameUri,
                maskTrackUri: options.maskTrackUri,
                frameRange: options.frameRange,
                referenceUris: referenceUris && referenceUris.length > 0
                    ? referenceUris.filter(uri => typeof uri === 'string' && uri.startsWith('gs://'))
                    : undefined,
                aspectRatio: normalizeVideoAspectRatio(effectiveAspectRatio),
                model: modelTier,
                resolution: effectiveResolution,
                durationSeconds: clampedDuration,
                directorSettings: cleanDirectorSettings,
                personGeneration: options.personGeneration,
                negativePrompt: options.negativePrompt,
                seed: options.seed,
                costEstimate: estimatedCost,
                costReservationId: effectiveCostReservationId,
                parentId: options.parentId,
                inputManifest: inputManifest.length > 0 ? inputManifest : undefined,
            };

            const compactedPayload = Object.fromEntries(
                Object.entries(payload).filter(([, v]) => v !== undefined && v !== null)
            );

            const payloadValidation = GenerateVideoSchema.safeParse(compactedPayload);
            if (!payloadValidation.success) {
                const errorMsg = payloadValidation.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
                throw new Error(`Invalid video gateway payload: ${errorMsg}`);
            }

            const res = await generateVideoV3(payloadValidation.data);
            const data = res.data as { jobId: string };

            // Return a job token here; the actual video URL resolves via waitForJob or the UI listener
            return [{
                id: data.jobId,
                url: '', 
                prompt: enrichedPrompt
            }];
        } catch (error: unknown) {
            logger.error('[VideoGeneration] ❌ Gateway generateVideoV3 failed:', error);
            if (ownsUnclaimedReservation) {
                try {
                    await CostControlService.voidUnclaimedVideoReservation(effectiveCostReservationId);
                } catch (releaseError) {
                    logger.warn('[VideoGeneration] Reservation release deferred to server reconciliation.', {
                        operationId: effectiveCostReservationId,
                        releaseError,
                    });
                }
            }
            throw error;
        }
    }

    /**
     * Subscribes to a video job status.
     */
    subscribeToJob(jobId: string, callback: (job: VideoJob | null) => void): () => void {
        const jobRef = doc(db, COLLECTIONS.VIDEO.JOBS, jobId);
        let maxQualityLevel = 0;

        const getQualityLevel = (q?: string): number => {
            if (q === 'pro') return 2;
            if (q === 'flash') return 1;
            return 0;
        };

        return onSnapshot(jobRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as VideoJob;
                const quality = data.output?.metadata?.quality;
                const currentLevel = getQualityLevel(quality);

                // Race Condition Protection:
                // If we have already seen a higher quality result (e.g. Pro),
                // ignore any subsequent lower quality updates (e.g. late arriving Flash).
                if (currentLevel < maxQualityLevel) {
                    return;
                }

                if (currentLevel > maxQualityLevel) {
                    maxQualityLevel = currentLevel;
                }

                callback({ ...data }); // data already contains id
            } else {
                callback(null);
            }
        });
    }

    /**
     * Await a job to reach a terminal state (completed or failed).
     */
    async waitForJob(jobId: string, timeoutMs: number = INTELLIGENCE_CONFIG.VIDEO.MAX_TIMEOUT_MS): Promise<VideoJob> {
        let unsub: (() => void) | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const jobPromise = new Promise((resolve, reject) => {
            unsub = this.subscribeToJob(jobId, async (job: VideoJob | null) => {
                if (!job) return;

                // 'stitching' is only a terminal (resolve-now) state for genuine
                // multi-segment long-form jobs, which have segmentUrls to assemble
                // (ISSUE-878). A single-generation job can also transiently report
                // 'stitching' as an intermediate progress marker before its final
                // 'completed' event carries the real output — that case must keep
                // waiting, not resolve early with an empty output (ISSUE-878 follow-up).
                const isLongFormStitching = job.status === 'stitching' && !!job.segmentUrls?.length;

                if (job.status === 'completed' || isLongFormStitching || job.status === 'failed' || job.status === 'cancelled') {
                    if (job.status === 'cancelled') {
                        reject(new Error(job.error || 'Video generation cancelled by user.'));
                        return;
                    }
                    if (isLongFormStitching) {
                        // Multi-segment long-form video: all segments are ready for assembly
                        // UI should use segmentUrls to build a timeline/project
                        resolve({
                            ...job,
                            output: job.output || { metadata: job.output?.metadata },
                        });
                    } else if (job.status === 'completed') {
                        // Enforce MIME Type Guard for Veo 3.1 Compliance
                        const mimeType = job.output?.metadata?.mime_type;
                        if (mimeType && mimeType !== 'video/mp4') {
                            reject(new Error(`Security Violation: Invalid MIME type '${mimeType}'. Expected 'video/mp4'.`));
                            return;
                        }

                        // Lens 🎥 Integrity Check: Verify Video Asset Availability (404 Protection)
                        const videoUrl = job.output?.url || job.videoUrl || job.url;
                        const playableUrl = videoUrl ? await resolveStorageUrl(videoUrl) : videoUrl;
                        // ISSUE-1395 (audit): a terminal 'completed' job with
                        // NO output URL violates the waitForJob contract —
                        // resolve() used to return url:undefined and let
                        // callers treat a URL-less job as a finished video.
                        if (!playableUrl) {
                            reject(new Error('Asset Integrity Failure: Video job completed without an output URL.'));
                            return;
                        }
                        // Skip integrity check for blob URLs — they are in-memory and always valid.
                        // HEAD requests are not supported on the blob: protocol.
                        if (typeof playableUrl === 'string' && !playableUrl.startsWith('blob:') && !playableUrl.startsWith('gs://') && (playableUrl.startsWith('http://') || playableUrl.startsWith('https://'))) {
                            try {
                                // HEAD request to verify existence without downloading payload
                                const response = await fetch(playableUrl, { method: 'HEAD' });
                                if (response.status === 404) {
                                    reject(new Error(`Asset Integrity Failure: Video URL is unreachable (${response.status}).`));
                                    return;
                                }
                            } catch (e: unknown) {
                                // Network error during verification should not block generation.
                                // Log for debugging but allow completion.
                                logger.warn("Lens: Video verification check failed", e);
                            }
                        } else if (playableUrl?.startsWith('gs://')) {
                            reject(new Error('Asset Integrity Failure: Video URL could not be resolved from Storage.'));
                            return;
                        }

                        resolve({
                            ...job,
                            output: job.output ? { ...job.output, url: playableUrl } : { url: playableUrl },
                            videoUrl: playableUrl,
                            url: playableUrl,
                        });
                    } else {
                        // Enhanced Safety Reporting
                        let errorMsg = job.error || 'Video generation failed.';
                        if (job.safety_ratings && Array.isArray(job.safety_ratings)) {
                            const blocked = job.safety_ratings.find((r: VideoSafetyRating) => r.blocked);
                            if (blocked) {
                                errorMsg = `Safety Violation: ${blocked.category} (${blocked.probability})`;
                            }
                        }
                        reject(new Error(errorMsg));
                    }
                }
            });
        });

        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Video generation timeout for Job ID: ${jobId}`));
            }, timeoutMs);
        });

        try {
            return await Promise.race([jobPromise, timeoutPromise]) as VideoJob;
        } finally {
            if (unsub) unsub();
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    /**
     * Triggers a long-form (Daisychaining) video generation job.
     * Uploads any visual reference and delegates all job creation, billing,
     * queueing, and provider execution to the protected backend. The browser
     * never writes a worker-triggering videoJobs document.
     * 
     * @param options - Configuration for long-form generation including totalDuration.
     * @returns A promise resolving to the main jobId token.
     */
    async generateLongFormVideo(options: {
        prompt: string;
        totalDuration: number;
        aspectRatio?: string;
        resolution?: string;
        seed?: number;
        negativePrompt?: string;
        firstFrame?: string;
        // NOTE: Audio is always-on for Veo 3.1 — no generateAudio parameter exists
        thinkingLevel?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
        inputAudio?: string;
        model?: string;
        onProgress?: (current: number, total: number) => void;
        userProfile?: UserProfile;
        personGeneration?: "dont_allow" | "allow_adult" | "allow_all";
        referenceImages?: {
            image: { uri?: string; imageBytes?: string; mimeType?: string };
            referenceType: 'asset'; // Official API only supports lowercase 'asset'
        }[];
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        // Security: Sanitize Prompt (Redact PII)
        const sanitizedPrompt = InputSanitizer.sanitize(options.prompt);
        // Long-form callers also accept UI model strings, so reject retired IDs
        // before their aggregate reservation and pass a gateway-safe tier to
        // every generated segment.
        const modelTier = normalizeVideoModelTier(options.model);

        const { useStore } = await import('@/core/store');
        const orgId = useStore.getState().currentOrganizationId;

        // Enrich prompt with distributor context
        const enrichedPrompt = this.enrichPrompt(sanitizedPrompt, {
            thinkingLevel: options.thinkingLevel
        }, options.userProfile);

        const targetAspectRatio = this.determineTargetAspectRatio(options);
        const validatedTargetAspectRatio = VideoAspectRatioSchema.safeParse(targetAspectRatio);
        const normalizedLongFormAspectRatio = validatedTargetAspectRatio.success ? validatedTargetAspectRatio.data : '16:9';

        // Construct segment-wise prompts for sequential generation
        // The server worker generates fixed five-second Veo segments; keep
        // browser planning identical to server billing and output duration.
        const BLOCK_DURATION = 5;
        const numBlocks = Math.ceil(options.totalDuration / BLOCK_DURATION);
        const prompts = Array.from({ length: numBlocks }, (_, i) =>
            `${enrichedPrompt} (Part ${i + 1}/${numBlocks})`
        );

        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('You must be signed in to generate video. Please log in.');

        const firstReference = options.referenceImages?.[0]?.image;
        const referenceSeed = firstReference?.uri
            ?? (firstReference?.imageBytes
                ? `data:${firstReference.mimeType || 'image/jpeg'};base64,${firstReference.imageBytes}`
                : undefined);
        const visualSeed = options.firstFrame ?? referenceSeed;
        const startImage = visualSeed
            ? await CreativeStorageService.uploadReferenceMedia(currentUser.uid, visualSeed, 'image')
            : undefined;
        const triggerLongFormVideoJob = httpsCallable(functions, 'triggerLongFormVideoJob');
        const response = await triggerLongFormVideoJob({
            prompts,
            totalDuration: numBlocks * 5,
            startImage,
            orgId: orgId || 'personal',
            options: {
                aspectRatio: normalizedLongFormAspectRatio,
                resolution: options.resolution,
                seed: options.seed,
                negativePrompt: options.negativePrompt,
                thinking: options.thinkingLevel !== 'none',
                model: modelTier,
            },
        });
        const data = response.data as { jobId?: string };
        if (!data.jobId) throw new Error('Long-form generation did not return a server job identifier.');
        return [{ id: data.jobId, url: '', prompt: options.prompt }];
    }

    /**
     * Enriches a base prompt (or generates one from scratch) using Audio DNA
     * from the NeuralCortexService.
     *
     * This is the automated pipe:
     *   AudioIntelligenceService.analyze()
     *     → NeuralCortexService.ingest()
     *     → NeuralCortexService.buildRenderDirectives()
     *     → VideoGenerationService.enrichPromptWithAudioDNA()
     *     → enriched veo prompt with mood, timbre, narrative
     *
     * @param contentId  The audio fingerprint ID (from AudioIntelligenceProfile.id)
     * @param basePrompt Optional override prompt. If omitted, the pure audio-derived
     *                   targetPrompts.veo is used as the base.
     * @returns RenderDirectives with enriched image + veo prompts, or null if
     *          the content ID doesn't exist in the Cortex.
     */
    async enrichPromptWithAudioDNA(
        contentId: string,
        basePrompt?: string
    ): Promise<RenderDirectives | null> {
        logger.info(`[VideoGeneration] Enriching prompt with Audio DNA for content: ${contentId}`);

        try {
            // 1. Retrieve the entity from NeuralCortex
            const entity = await neuralCortex.getEntity(contentId);

            if (!entity) {
                logger.warn(`[VideoGeneration] No Cortex entity found for content ID: ${contentId}. ` +
                    `Run AudioIntelligenceService.analyze() + neuralCortex.ingest() first.`);
                return null;
            }

            // 2. Build render directives (enriched prompts with mood, timbre, lighting)
            const directives = neuralCortex.buildRenderDirectives(entity);

            // 3. If a base prompt override was provided, prepend it to the veo prompt
            if (basePrompt) {
                directives.veoPrompt = `${basePrompt}. ${directives.veoPrompt}`;
                directives.imagePrompt = `${basePrompt}. ${directives.imagePrompt}`;
            }

            logger.info(`[VideoGeneration] Audio DNA enrichment complete. Style: ${directives.styleSummary}`);

            if (directives.driftWarning) {
                logger.warn(`[VideoGeneration] ${directives.driftWarning}`);
            }

            return directives;
        } catch (error: unknown) {
            logger.error('[VideoGeneration] Audio DNA enrichment failed:', error);
            return null;
        }
    }

    /**
     * One-shot convenience: enrich with Audio DNA + generate video.
     *
     * Combines enrichPromptWithAudioDNA() + generateVideo() into a single call.
     * Falls back to the raw basePrompt if Audio DNA enrichment fails or yields null.
     *
     * @param contentId   Audio fingerprint ID from AudioIntelligenceProfile.id
     * @param options     Standard VideoGenerationOptions — the prompt field will be
     *                    overridden with the enriched veo prompt.
     */
    async generateVideoFromAudioDNA(
        contentId: string,
        options: VideoGenerationOptions
    ): Promise<{ id: string; url: string; prompt: string }[]> {
        const directives = await this.enrichPromptWithAudioDNA(contentId, options.prompt);

        if (directives) {
            logger.info(`[VideoGeneration] Using Audio DNA-enriched prompt for generation`);
            return this.generateVideo({
                ...options,
                prompt: directives.veoPrompt,
            });
        }

        // Fallback: Audio DNA not available, use raw prompt
        logger.info(`[VideoGeneration] Audio DNA unavailable, falling back to raw prompt`);
        return this.generateVideo(options);
    }
}

export const VideoGeneration = new VideoGenerationService();
