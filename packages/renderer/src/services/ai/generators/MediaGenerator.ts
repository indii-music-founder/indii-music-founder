/**
 * Media Generator — Video generation logic extracted from FirebaseAIService.
 *
 * This module handles the Veo 3.1 video generation pipeline:
 *   1. Model resolution & config building
 *   2. Operation submission via @google/genai SDK
 *   3. Polling for completion
 *   4. Result extraction (URI fetch → blob URL, or raw bytes → blob URL)
 *   5. Error mapping to typed AppExceptions
 *
 * Extracted from FirebaseAIService.ts for cleaner separation.
 */

import type { GoogleGenAI } from '@google/genai';
import { AI_MODELS } from '@/core/config/ai-models';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import type { GenerateVideoRequest } from '@/shared/types/ai.dto';
import { logger } from '@/utils/logger';


/**
 * Resolution map — maps UI resolution strings to Veo API enum values.
 */
const RESOLUTION_MAP: Record<string, string> = {
    '1280x720': '720p',
    '1920x1080': '1080p',
    '3840x2160': '4k',
    '720p': '720p',
    '1080p': '1080p',
    '4k': '4k',
};

/**
 * Generate a video using the @google/genai SDK (client-side Veo 3.1).
 *
 * This bypasses Cloud Functions entirely by calling models.generateVideos()
 * from the @google/genai SDK, then polling the returned operation until done.
 * Matches the pattern used by image generation (direct SDK call, no backend proxy).
 *
 * @param client - The initialized GoogleGenAI client
 * @param options - Video generation request + optional timeout override
 * @returns A blob URL or raw URI pointing at the generated video
 */
export async function generateVideo(
    client: GoogleGenAI,
    options: GenerateVideoRequest & { timeoutMs?: number }
): Promise<string> {
    const { calculateVideoTimeout, AI_CONFIG } = await import('@/core/config/ai-models');
    
    /**
     * Video model alias map — resolves abbreviated UI names to full model IDs.
     */
    const VIDEO_MODEL_ALIASES: Record<string, string> = {
        'pro': AI_MODELS.VIDEO.PRO,
        'fast': AI_MODELS.VIDEO.FAST,
        'lite': AI_MODELS.VIDEO.LITE,
        'edit': AI_MODELS.VIDEO.EDIT,
        'generation': AI_MODELS.VIDEO.GENERATION,
    };

    const durationSeconds = options.config?.durationSeconds || AI_CONFIG.VIDEO.DEFAULT_DURATION_SECONDS;
    const timeoutMs = options.timeoutMs || calculateVideoTimeout(durationSeconds);

    // Determine model — resolve abbreviated UI names to full model IDs
    const rawModel = options.model || '';
    const modelId = VIDEO_MODEL_ALIASES[rawModel.toLowerCase()] || rawModel || AI_MODELS.VIDEO.PRO;

    // Clamp duration to API-valid range [5, 8] as integer
    const clampedDuration = Math.min(8, Math.max(5, Math.round(durationSeconds)));

    // Build properly-typed generateVideos config
    // NOTE: personGeneration and generateAudio are NOT supported in current Veo preview.
    // Do NOT include them — the API will return 400 errors.
    const videoConfig: Record<string, unknown> = {
        numberOfVideos: 1,
        durationSeconds: clampedDuration,
        aspectRatio: options.config?.aspectRatio || '16:9',
    };

    // Add optional config fields (only API-supported params)
    if (options.config?.resolution) {
        const mapped = RESOLUTION_MAP[options.config.resolution];
        videoConfig.resolution = mapped || options.config.resolution;
    }
    // NOTE: generateAudio is NOT supported in the current Gemini/Veo API.
    // Passing it causes: "generateAudio parameter is not supported in Gemini API."
    // When the API adds support, uncomment the block below.
    // if (options.config?.generateAudio !== undefined) {
    //     videoConfig.generateAudio = options.config.generateAudio;
    // }
    if (options.config?.negativePrompt) {
        videoConfig.negativePrompt = options.config.negativePrompt;
    }
    if (options.config?.seed !== undefined) {
        videoConfig.seed = options.config.seed;
    }
    if (options.config?.enhancePrompt !== undefined) {
        videoConfig.enhancePrompt = options.config.enhancePrompt;
    }
    if (options.config?.referenceImages && Array.isArray(options.config.referenceImages) && options.config.referenceImages.length > 0) {
        videoConfig.referenceImages = options.config.referenceImages;
    }
    if (options.config?.lastFrame) {
        videoConfig.lastFrame = options.config.lastFrame;
    }

    // Build image input (first frame / image-to-video)
    let imageInput: { imageBytes: string; mimeType: string } | undefined;
    if (options.image) {
        let imageBytes = options.image.imageBytes || options.image.data;
        const mimeType = options.image.mimeType || 'image/jpeg';
        if (imageBytes) {
            // Strip data URI prefix if present — API expects raw base64
            if (imageBytes.startsWith('data:')) {
                imageBytes = imageBytes.split(',')[1] || imageBytes;
            }
            imageInput = { imageBytes, mimeType };
        }
    }

    logger.info('[MediaGenerator] Generating video with @google/genai SDK:', {
        model: modelId,
        promptLength: options.prompt.length,
        promptPreview: options.prompt.substring(0, 120),
        durationSeconds,
        clampedDuration,
        hasImage: !!imageInput,
        config: JSON.stringify(videoConfig),
        timeoutMs,
    });

    try {
        // 1. Start the video generation operation
        logger.info('[MediaGenerator] 🚀 Submitting generateVideos request...');
        let operation = await client.models.generateVideos({
            model: modelId,
            prompt: options.prompt,
            ...(imageInput ? { image: imageInput } : {}),
            config: videoConfig as Parameters<typeof client.models.generateVideos>[0]['config'],
        });

        logger.info('[MediaGenerator] ✅ Operation created successfully.', {
            operationName: operation.name || '(no name)',
            done: operation.done,
            hasResponse: !!operation.response,
            hasError: !!operation.error,
        });

        // If the operation completed immediately (unlikely but possible for cached results)
        if (operation.done) {
            logger.info('[MediaGenerator] Operation completed immediately (no polling needed).');
        }

        // 2. Poll for completion
        const pollInterval = 10000; // 10 seconds — matches official Veo docs recommendation
        const maxAttempts = Math.ceil(timeoutMs / pollInterval);
        let attempts = 0;
        let consecutivePollErrors = 0;
        const MAX_CONSECUTIVE_POLL_ERRORS = 5;

        while (!operation.done && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            attempts++;

            try {
                // Re-poll the operation
                operation = await client.operations.getVideosOperation({
                    operation: operation,
                });
                consecutivePollErrors = 0; // Reset on successful poll

                // Log every poll attempt for full diagnostics
                logger.info(`[MediaGenerator] Poll ${attempts}/${maxAttempts}:`, {
                    done: operation.done,
                    hasResponse: !!operation.response,
                    hasError: !!operation.error,
                    videoCount: operation.response?.generatedVideos?.length ?? 0,
                    raiFiltered: operation.response?.raiMediaFilteredCount ?? 0,
                });

                // On first successful poll, log the full operation shape for debugging
                if (attempts === 1) {
                    logger.info('[MediaGenerator] First poll — operation keys:', Object.keys(operation));
                    if (operation.response) {
                        logger.info('[MediaGenerator] First poll — response keys:', Object.keys(operation.response));
                    }
                }

                // Early exit: Check if the operation has errored out mid-polling
                if (operation.error) {
                    const errorDetail = JSON.stringify(operation.error);
                    logger.error(`[MediaGenerator] ❌ Operation error detected during polling:`, errorDetail);
                    throw new AppException(
                        AppErrorCode.INTERNAL_ERROR,
                        `Video generation failed during processing: ${errorDetail}`
                    );
                }

                // Early exit: Check if RAI filtered all videos
                if (operation.response?.raiMediaFilteredCount && operation.response.raiMediaFilteredCount > 0 && !operation.response?.generatedVideos?.length) {
                    const reasons = operation.response.raiMediaFilteredReasons?.join(', ') || 'content policy violation';
                    logger.error(`[MediaGenerator] ❌ All videos filtered by safety: ${reasons}`);
                    throw new AppException(
                        AppErrorCode.CONTENT_FILTERED,
                        `Video was blocked by safety filters: ${reasons}. Try a different prompt.`
                    );
                }
            } catch (pollError: unknown) {
                // If it's already an AppException from our early exit checks, re-throw
                if (pollError instanceof AppException) throw pollError;

                consecutivePollErrors++;
                const pollMsg = pollError instanceof Error ? pollError.message : String(pollError);
                logger.warn(`[MediaGenerator] ⚠️ Poll ${attempts} failed (${consecutivePollErrors}/${MAX_CONSECUTIVE_POLL_ERRORS}):`, pollMsg);

                if (consecutivePollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
                    throw new AppException(
                        AppErrorCode.INTERNAL_ERROR,
                        `Video generation polling failed after ${consecutivePollErrors} consecutive errors. Last error: ${pollMsg}`
                    );
                }
                // Continue polling — transient network errors shouldn't kill the operation
            }
        }

        if (!operation.done) {
            logger.error(`[MediaGenerator] ❌ Timeout: ${attempts} poll attempts exhausted (${Math.round(timeoutMs / 1000)}s).`);
            throw new AppException(
                AppErrorCode.TIMEOUT,
                `Video generation timed out after ${attempts} poll attempts (${Math.round(timeoutMs / 1000)}s).`
            );
        }

        logger.info('[MediaGenerator] ✅ Operation completed. Extracting results...');

        // 3. Extract the video URL from the typed operation response
        const generatedVideos = operation.response?.generatedVideos;

        logger.info('[MediaGenerator] Response inspection:', {
            hasResponse: !!operation.response,
            generatedVideoCount: generatedVideos?.length ?? 0,
            hasError: !!operation.error,
            raiFilteredCount: operation.response?.raiMediaFilteredCount ?? 0,
            raiReasons: operation.response?.raiMediaFilteredReasons ?? [],
            responseKeys: operation.response ? Object.keys(operation.response) : [],
        });

        // Priority 1: Check for RAI filtering FIRST (most common silent failure)
        if (operation.response?.raiMediaFilteredCount && operation.response.raiMediaFilteredCount > 0) {
            const reasons = operation.response.raiMediaFilteredReasons?.join(', ') || 'content policy violation';
            // If some videos were filtered but some were generated, log a warning and continue
            if (!generatedVideos || generatedVideos.length === 0) {
                logger.error(`[MediaGenerator] ❌ All videos blocked by safety filters: ${reasons}`);
                throw new AppException(
                    AppErrorCode.CONTENT_FILTERED,
                    `Video was blocked by safety filters: ${reasons}. Try a different prompt.`
                );
            }
            logger.warn(`[MediaGenerator] ⚠️ ${operation.response.raiMediaFilteredCount} video(s) filtered by safety (${reasons}), but ${generatedVideos.length} passed.`);
        }

        // Priority 2: Check for operation-level errors
        if (operation.error) {
            logger.error(`[MediaGenerator] ❌ Operation completed with error:`, JSON.stringify(operation.error));
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                `Video generation failed: ${JSON.stringify(operation.error)}`
            );
        }

        // Priority 3: Extract video data
        if (generatedVideos && generatedVideos.length > 0) {
            const firstVideo = generatedVideos[0]!;
            const videoUri = firstVideo.video?.uri;
            const videoBytes = firstVideo.video?.videoBytes;

            logger.info('[MediaGenerator] First video inspection:', {
                hasUri: !!videoUri,
                uriPreview: videoUri ? videoUri.substring(0, 100) : '(none)',
                hasVideoBytes: !!videoBytes,
                videoBytesLength: videoBytes ? videoBytes.length : 0,
                mimeType: firstVideo.video?.mimeType ?? '(not set)',
                videoKeys: firstVideo.video ? Object.keys(firstVideo.video) : [],
            });

            if (videoUri) {
                logger.info(`[MediaGenerator] ✅ Video URI received, fetching bytes for playback...`);

                // Native <video> elements cannot attach custom headers (x-goog-api-key).
                // The raw Gemini API URI requires authentication, so we fetch the bytes
                // via an authenticated request and create a blob URL for the browser.
                try {
                    const apiKey = import.meta.env.VITE_API_KEY;
                    const fetchUrl = videoUri.includes('?')
                        ? `${videoUri}&key=${apiKey}`
                        : `${videoUri}?key=${apiKey}`;

                    logger.info('[MediaGenerator] Fetching video bytes from authenticated URI...');
                    const videoResponse = await fetch(fetchUrl);
                    if (!videoResponse.ok) {
                        throw new Error(`HTTP ${videoResponse.status}: ${videoResponse.statusText}`);
                    }
                    const videoBlob = await videoResponse.blob();
                    const blobUrl = URL.createObjectURL(videoBlob);
                    logger.info(`[MediaGenerator] ✅ Video ready for playback (blob): ${blobUrl} (${(videoBlob.size / 1024 / 1024).toFixed(2)} MB)`);
                    return blobUrl;
                } catch (fetchError: unknown) {
                    const fetchMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
                    logger.warn(`[MediaGenerator] ⚠️ Failed to fetch video bytes (${fetchMsg}), falling back to raw URI`);
                    // Fall back to raw URI — may still fail in <video> but allows Electron/download paths to work
                    return videoUri;
                }
            }

            // If we got raw bytes instead of a URI, create a blob URL
            if (videoBytes) {
                const mimeType = firstVideo.video?.mimeType || 'video/mp4';
                logger.info(`[MediaGenerator] Converting raw video bytes to blob URL (${videoBytes.length} chars, ${mimeType})...`);
                const byteArray = Uint8Array.from(atob(videoBytes), c => c.charCodeAt(0));
                const blob = new Blob([byteArray], { type: mimeType });
                const blobUrl = URL.createObjectURL(blob);
                logger.info(`[MediaGenerator] ✅ Video generated (blob): ${blobUrl} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
                return blobUrl;
            }

            // Video object exists but has neither URI nor bytes — this is a bug
            logger.error('[MediaGenerator] ❌ Video object exists but has neither URI nor bytes:', JSON.stringify(firstVideo.video));
        }

        // No generated videos at all
        logger.error('[MediaGenerator] ❌ Operation completed but no video data was returned.', {
            responseJson: JSON.stringify(operation.response ?? {}),
            errorJson: JSON.stringify(operation.error ?? {}),
        });
        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            'Video generation completed but no video data was returned. This may indicate a temporary API issue — please try again.'
        );
    } catch (error: unknown) {
        if (error instanceof AppException) throw error;

        const msg = error instanceof Error ? error.message : String(error);
        logger.error('[MediaGenerator] Video generation error:', msg);

        // Map common API errors to typed AppExceptions
        if (msg.includes('quota') || msg.includes('resource-exhausted') || msg.includes('RESOURCE_EXHAUSTED')) {
            throw new AppException(AppErrorCode.QUOTA_EXCEEDED, 'Video generation quota exceeded. Please try again later.');
        }
        if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
            throw new AppException(AppErrorCode.RATE_LIMITED, 'Video generation rate limited. Please wait a moment and try again.', { retryable: true });
        }
        if (msg.includes('permission') || msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
            throw new AppException(AppErrorCode.UNAUTHORIZED, 'Video generation permission denied. Check your API key permissions.');
        }
        if (msg.includes('invalid') || msg.includes('INVALID_ARGUMENT')) {
            throw new AppException(AppErrorCode.INVALID_INPUT, `Video generation invalid input: ${msg}`);
        }

        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            `Video generation failed: ${msg}`
        );
    }
}
