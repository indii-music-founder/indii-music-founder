import { firebaseAI } from '../ai/FirebaseAIService';
import { AI_CONFIG, AI_MODELS } from '@/core/config/ai-models';
import { v4 as uuidv4 } from 'uuid';
import { db, auth } from '@/services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { QuotaExceededError } from '@/shared/types/errors';
import { UserProfile } from '@/modules/workflow/types';
import { getVideoConstraints } from '../onboarding/DistributorContext';
import { VideoGenerationOptionsSchema, VideoGenerationOptions, VideoAspectRatioSchema } from '@/modules/video/schemas';
import { z } from 'zod';
import { InputSanitizer } from '@/services/ai/utils/InputSanitizer';
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService';
import { VideoJob, VideoSafetyRating } from '@/types/video';
import { logger } from '@/utils/logger';

type VideoAspectRatio = z.infer<typeof VideoAspectRatioSchema>;

const DEFAULT_VIDEO_MODEL = AI_MODELS.VIDEO.PRO; // 'veo-3-generate-preview'

/** Strip undefined values from an object to prevent Firestore rejection. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
    ) as T;
}

/**
 * VideoGenerationService - Client-side orchestrator for AI video production
 * 
 * Handles quota checking, prompt enrichment (cinematography/physics), 
 * temporal context analysis, and triggering both atomic and long-form 
 * Daisychaining video generation via Cloud Functions.
 */
export class VideoGenerationService {

    private async analyzeTemporalContext(image: string, offset: number, basePrompt: string): Promise<string> {
        try {
            const direction = offset > 0 ? 'future' : 'past';
            const duration = Math.abs(offset);

            const analysisPrompt = `You are a master cinematographer and physics engine.
            Analyze this image frame which represents the ${offset > 0 ? 'START' : 'END'} of a video sequence.
            Context: "${basePrompt}"

            Task: Predict exactly what happens ${duration} seconds into the ${direction}.
            Describe the motion, physics, lighting changes, and character actions that bridge this gap.
            Focus on continuity and logical progression.

            Return a concise but descriptive paragraph (max 50 words) describing the video sequence.`;

            return await firebaseAI.analyzeImage(analysisPrompt, image);
        } catch (__e: unknown) {
            // Temporal analysis failure should not block generation
            return "";
        }
    }

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
            // Fail open in DEV
            return { canGenerate: true };
        }
    }

    private enrichPrompt(basePrompt: string, settings: { camera?: string, motion?: number, fps?: number, thinking?: boolean }, userProfile?: UserProfile): string {
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
     * @google/genai SDK directly via FirebaseAIService (no Cloud Functions).
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

        // Enforce Authentication — capture UID immediately to prevent race condition
        // (auth.currentUser can become null between check and use)
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error("You must be signed in to generate video. Please log in.");
        }
        const userId = currentUser.uid;

        // Enforce quota check
        const quota = await this.checkVideoQuota(1);
        if (!quota.canGenerate) {
            throw new Error(`Quota exceeded: ${quota.reason}`);
        }

        // Security: Sanitize Prompt (Redact PII)
        const sanitizedPrompt = InputSanitizer.sanitize(options.prompt);

        // Temporal context analysis
        let temporalContext = "";
        if (options.firstFrame || options.lastFrame) {
            const reference = options.firstFrame || options.lastFrame;
            if (reference) {
                temporalContext = await this.analyzeTemporalContext(reference, options.timeOffset || 4, options.prompt);
            }
        }

        // Map internal parameters to AI service expectations
        let enrichedPrompt = this.enrichPrompt(sanitizedPrompt, {
            camera: options.cameraMovement,
            motion: options.motionStrength,
            fps: options.fps,
            thinking: options.thinking
        }, options.userProfile);

        if (temporalContext) {
            enrichedPrompt += ` ${temporalContext}`;
        }

        const targetAspectRatio = this.determineTargetAspectRatio(options);

        const { useStore } = await import('@/core/store');
        const orgId = useStore.getState().currentOrganizationId;
        const jobId = uuidv4();

        // Write initial job record to Firestore for UI subscription
        const { setDoc, serverTimestamp } = await import('firebase/firestore');
        const jobRef = doc(db, 'videoJobs', jobId);
        await setDoc(jobRef, stripUndefined({
            id: jobId,
            userId,
            orgId: orgId || 'personal',
            prompt: enrichedPrompt,
            status: 'processing',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            options: stripUndefined({
                aspectRatio: targetAspectRatio,
                resolution: options.resolution,
                duration: options.duration || options.durationSeconds || 8,
                // Audio is always-on for Veo 3.1
                model: options.model || DEFAULT_VIDEO_MODEL,
            }),
        }));

        // Persist video metadata for future retrieval and agent context
        metadataPersistenceService.save('video', {
            jobId,
            prompt: options.prompt,
            enrichedPrompt,
            aspectRatio: targetAspectRatio,
            cameraMovement: options.cameraMovement,
            motionStrength: options.motionStrength,
            duration: options.duration || 4,
            hasFirstFrame: !!options.firstFrame,
            hasLastFrame: !!options.lastFrame,
            // Audio is always-on for Veo 3.1
            model: options.model,
            status: 'processing',
            generatedAt: new Date().toISOString(),
        }, {
            showToasts: false,
            maxRetries: 1,
            queueOnFailure: true,
        }).catch(err => {
            logger.warn('[VideoGeneration] Failed to persist video metadata:', err);
        });

        // Build the image input if first frame is provided
        // The Veo API expects raw base64 bytes, NOT data URIs with the prefix.
        let firstFrameBytes: string | undefined;
        if (options.firstFrame) {
            firstFrameBytes = options.firstFrame;
            // Strip data URI prefix if present (e.g. "data:image/jpeg;base64,...")
            if (firstFrameBytes.startsWith('data:')) {
                firstFrameBytes = firstFrameBytes.split(',')[1] || firstFrameBytes;
            }
        }

        const imageInput = firstFrameBytes
            ? { imageBytes: firstFrameBytes, mimeType: 'image/jpeg' }
            : options.image
                ? { imageBytes: options.image.imageBytes, mimeType: options.image.mimeType || 'image/jpeg' }
                : undefined;

        // Build lastFrame as the @google/genai SDK Image type.
        // SDK expects: { imageBytes: string; mimeType: string } (flat, no nesting).
        // See: node_modules/@google/genai/dist/genai.d.ts → Image_2
        let lastFrameConfig: { imageBytes: string; mimeType: string } | undefined;
        if (options.lastFrame) {
            let lastFrameBytes = options.lastFrame;
            // Strip data URI prefix if present
            if (lastFrameBytes.startsWith('data:')) {
                lastFrameBytes = lastFrameBytes.split(',')[1] || lastFrameBytes;
            }
            lastFrameConfig = {
                imageBytes: lastFrameBytes,
                mimeType: 'image/jpeg'
            };
        }

        // Generate video via direct @google/genai SDK (no Cloud Functions)
        try {
            const videoUrl = await firebaseAI.generateVideo({
                prompt: enrichedPrompt,
                model: options.model || DEFAULT_VIDEO_MODEL,
                image: imageInput,
                config: stripUndefined({
                    aspectRatio: targetAspectRatio || '16:9',
                    resolution: options.resolution,
                    durationSeconds: options.duration || options.durationSeconds || 8,
                    // NOTE: generateAudio and personGeneration are NOT supported in Veo 3.1 preview.
                    // Including them causes 400 errors. Do NOT add them back without API verification.
                    negativePrompt: options.negativePrompt,
                    referenceImages: options.referenceImages?.length ? options.referenceImages : undefined,
                    lastFrame: lastFrameConfig,
                }),
            });

            // Update Firestore with completed status for UI subscription
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(jobRef, {
                status: 'completed',
                videoUrl: videoUrl,
                'output.url': videoUrl,
                'output.metadata.quality': 'pro',
                'output.metadata.mime_type': 'video/mp4',
                updatedAt: serverTimestamp(),
                completedAt: serverTimestamp(),
            });

            // 🔥 Fire-and-forget: Upload blob to Firebase Storage for durable persistence.
            // Blob URLs are session-scoped and won't survive page refresh.
            // This background upload ensures the video remains accessible in future sessions.
            if (videoUrl.startsWith('blob:')) {
                (async () => {
                    try {
                        const blobResponse = await fetch(videoUrl);
                        const blob = await blobResponse.blob();
                        const file = new File([blob], `veo_${jobId}.mp4`, { type: 'video/mp4' });

                        const { VideoUploadService } = await import('./VideoUploadService');
                        const storagePath = `videos/${userId}/${jobId}.mp4`;
                        const uploadResult = await VideoUploadService.uploadVideo(file, storagePath);

                        // Update Firestore with durable Storage URL
                        const { updateDoc: updateDocAsync } = await import('firebase/firestore');
                        await updateDocAsync(jobRef, {
                            videoUrl: uploadResult.url,
                            'output.url': uploadResult.url,
                            'output.storagePath': uploadResult.path,
                            updatedAt: serverTimestamp(),
                        });

                        // 🔑 Critical: Propagate the durable URL to in-memory Zustand state.
                        // Without this, the store retains the ephemeral blob: URL and
                        // video playback breaks after page refresh or blob GC.
                        const { useStore: storeRef } = await import('@/core/store');
                        storeRef.getState().updateHistoryItem(jobId, { url: uploadResult.url });

                        logger.info(`[VideoGeneration] ✅ Video persisted to Storage: ${uploadResult.url}`);
                    } catch (uploadError: unknown) {
                        logger.warn('[VideoGeneration] Background Storage upload failed (non-blocking):', uploadError);
                    }
                })();
            }

            return [{
                id: jobId,
                url: videoUrl,
                prompt: enrichedPrompt
            }];
        } catch (error: unknown) {
            // Update Firestore with failure for UI subscription
            const { updateDoc } = await import('firebase/firestore');
            const errorMsg = error instanceof Error ? error.message : String(error);

            await updateDoc(jobRef, {
                status: 'failed',
                error: errorMsg,
                updatedAt: serverTimestamp(),
            }).catch(e => logger.warn('[VideoGeneration] Failed to update job status:', e));

            throw error;
        }
    }

    /**
     * Subscribes to a video job status.
     */
    subscribeToJob(jobId: string, callback: (job: VideoJob | null) => void): () => void {
        const jobRef = doc(db, 'videoJobs', jobId);
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
    async waitForJob(jobId: string, timeoutMs: number = AI_CONFIG.VIDEO.MAX_TIMEOUT_MS): Promise<VideoJob> {
        let unsub: (() => void) | undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        const jobPromise = new Promise((resolve, reject) => {
            unsub = this.subscribeToJob(jobId, async (job: VideoJob | null) => {
                if (!job) return;

                if (job.status === 'completed' || job.status === 'failed') {
                    if (job.status === 'completed') {
                        // Enforce MIME Type Guard for Veo 3.1 Compliance
                        const mimeType = job.output?.metadata?.mime_type;
                        if (mimeType && mimeType !== 'video/mp4') {
                            reject(new Error(`Security Violation: Invalid MIME type '${mimeType}'. Expected 'video/mp4'.`));
                            return;
                        }

                        // Lens 🎥 Integrity Check: Verify Video Asset Availability (404 Protection)
                        const videoUrl = job.output?.url;
                        // Skip integrity check for blob URLs — they are in-memory and always valid.
                        // HEAD requests are not supported on the blob: protocol.
                        if (videoUrl && !videoUrl.startsWith('blob:')) {
                            try {
                                // HEAD request to verify existence without downloading payload
                                const response = await fetch(videoUrl, { method: 'HEAD' });
                                if (!response.ok) {
                                    reject(new Error(`Asset Integrity Failure: Video URL is unreachable (${response.status}).`));
                                    return;
                                }
                            } catch (e: unknown) {
                                // Network error during verification should not block generation unless strictly required.
                                // We log the warning for debugging purposes, but proceed with strict verification logic.
                                logger.warn("Lens: Video verification check failed", e);
                            }
                        }

                        resolve(job);
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
     * Splices a long request into segments, enriches them, and generates each segment
     * sequentially via the direct SDK, then writes results to Firestore.
     * 
     * @param options - Configuration for long-form generation including totalDuration.
     * @returns A promise resolving to the main jobId placeholder.
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
        thinking?: boolean;
        inputAudio?: string;
        model?: string;
        onProgress?: (current: number, total: number) => void;
        userProfile?: UserProfile;
        personGeneration?: "dont_allow" | "allow_adult" | "allow_all";
        referenceImages?: {
            image: { uri: string };
            referenceType: 'asset'; // Official API only supports lowercase 'asset'
        }[];
    }): Promise<{ id: string, url: string, prompt: string }[]> {
        // Security: Sanitize Prompt (Redact PII)
        const sanitizedPrompt = InputSanitizer.sanitize(options.prompt);

        // Pre-flight duration quota check
        const quotaCheck = await subscriptionService.canPerformAction('generateVideo', options.totalDuration);
        if (!quotaCheck.allowed) {
            const tier = await subscriptionService.getCurrentSubscription().then(s => s.tier);
            throw new QuotaExceededError(
                'video_duration',
                await tier,
                quotaCheck.reason || `Video duration ${options.totalDuration}s exceeds tier limit`,
                options.totalDuration,
                quotaCheck.currentUsage?.limit || options.totalDuration
            );
        }

        const jobId = `long_${uuidv4()}`;
        const { useStore } = await import('@/core/store');
        const orgId = useStore.getState().currentOrganizationId;

        // Enrich prompt with distributor context
        const enrichedPrompt = this.enrichPrompt(sanitizedPrompt, {
            thinking: options.thinking
        }, options.userProfile);

        const targetAspectRatio = this.determineTargetAspectRatio(options);

        // Construct segment-wise prompts for sequential generation
        const BLOCK_DURATION = 8;
        const numBlocks = Math.ceil(options.totalDuration / BLOCK_DURATION);
        const prompts = Array.from({ length: numBlocks }, (_, i) =>
            `${enrichedPrompt} (Part ${i + 1}/${numBlocks})`
        );

        // Write initial long-form job to Firestore
        const { setDoc, serverTimestamp } = await import('firebase/firestore');
        const jobRef = doc(db, 'videoJobs', jobId);
        await setDoc(jobRef, {
            id: jobId,
            userId: auth.currentUser?.uid,
            orgId: orgId || 'personal',
            prompt: enrichedPrompt,
            status: 'processing',
            type: 'long_form',
            totalSegments: numBlocks,
            completedSegments: 0,
            segmentUrls: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        // =====================================================================
        // DAISY CHAIN ENGINE: Sequential generation with visual continuity
        //
        // Pipeline per segment:
        //   1. Generate video (with firstFrame from previous segment's last frame)
        //   2. Extract last frame from completed video
        //   3. Analyze frame with Gemini to generate continuation prompt
        //   4. Use analysis + base prompt for next segment
        //   5. Repeat until all segments are generated
        // =====================================================================
        const segmentUrls: string[] = [];
        let previousLastFrame: string | undefined = options.firstFrame; // Start with user-provided first frame
        let chainContext = ''; // Accumulates narrative context across segments

        try {
            for (let i = 0; i < prompts.length; i++) {
                options.onProgress?.(i, numBlocks);

                // Build segment prompt with chain context
                let segmentPrompt = prompts[i]!;
                if (chainContext && i > 0) {
                    segmentPrompt = `${segmentPrompt}\n\nVisual Continuity Context (from previous segment): ${chainContext}`;
                }

                // Generate segment — with firstFrame from previous segment's last frame
                const videoUrl = await firebaseAI.generateVideo({
                    prompt: segmentPrompt,
                    model: options.model || DEFAULT_VIDEO_MODEL,
                    image: previousLastFrame
                        ? { imageBytes: previousLastFrame, mimeType: 'image/jpeg' }
                        : undefined,
                    config: stripUndefined({
                        aspectRatio: targetAspectRatio || '16:9',
                        resolution: options.resolution,
                        durationSeconds: BLOCK_DURATION,
                        negativePrompt: options.negativePrompt,
                        seed: options.seed,
                    }),
                });

                segmentUrls.push(videoUrl);

                // Update progress in Firestore
                const { updateDoc } = await import('firebase/firestore');
                await updateDoc(jobRef, {
                    completedSegments: i + 1,
                    segmentUrls,
                    updatedAt: serverTimestamp(),
                });

                // ─── DAISY CHAIN: Extract last frame & analyze for next segment ───
                if (i < prompts.length - 1) {
                    try {
                        // Step 1: Extract the last frame from the completed segment
                        const { extractLastFrameForAPI } = await import('@/utils/video');
                        const lastFrameResult = await extractLastFrameForAPI(videoUrl);
                        previousLastFrame = lastFrameResult.imageBytes;

                        logger.info(`[DaisyChain] Segment ${i + 1}/${numBlocks}: Last frame extracted (${lastFrameResult.mimeType})`);

                        // Step 2: Analyze the frame with Gemini to understand scene state
                        const analysisResult = await this.analyzeTemporalContext(
                            lastFrameResult.dataUrl,
                            BLOCK_DURATION, // Looking forward by one block
                            options.prompt
                        );

                        if (analysisResult) {
                            chainContext = analysisResult;
                            logger.info(`[DaisyChain] Segment ${i + 1}/${numBlocks}: Scene analysis complete — "${analysisResult.substring(0, 80)}..."`);
                        }

                        // Update Firestore with chain state for resume capability
                        await updateDoc(jobRef, {
                            'chainState.lastFrameSegment': i,
                            'chainState.lastAnalysis': chainContext.substring(0, 500),
                            updatedAt: serverTimestamp(),
                        });
                    } catch (chainError: unknown) {
                        // Daisy chain enhancement is best-effort — don't block generation
                        logger.warn(
                            `[DaisyChain] Frame extraction/analysis failed for segment ${i + 1}. Continuing without visual continuity.`,
                            chainError
                        );
                        // Reset chain state so next segment generates fresh
                        previousLastFrame = undefined;
                        chainContext = '';
                    }
                }
            }

            options.onProgress?.(numBlocks, numBlocks);

            // Mark as completed with all segment URLs
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(jobRef, {
                status: 'completed',
                videoUrl: segmentUrls[0]!, // Primary URL is first segment
                segmentUrls,
                'output.url': segmentUrls[0]!,
                'output.metadata.quality': 'pro',
                'output.metadata.mime_type': 'video/mp4',
                'chainState.complete': true,
                'chainState.totalSegments': numBlocks,
                updatedAt: serverTimestamp(),
                completedAt: serverTimestamp(),
            });

            return [{
                id: jobId,
                url: segmentUrls[0]!,
                prompt: options.prompt
            }];
        } catch (error: unknown) {
            const { updateDoc } = await import('firebase/firestore');
            const errorMsg = error instanceof Error ? error.message : String(error);

            await updateDoc(jobRef, {
                status: 'failed',
                error: errorMsg,
                segmentUrls,
                'chainState.failedAtSegment': segmentUrls.length,
                updatedAt: serverTimestamp(),
            }).catch(e => logger.warn('[VideoGeneration] Failed to update long-form job status:', e));

            throw error;
        }
    }
}

export const VideoGeneration = new VideoGenerationService();
