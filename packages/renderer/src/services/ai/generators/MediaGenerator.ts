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
 * Video model alias map — resolves abbreviated UI names to full model IDs.
 */
const VIDEO_MODEL_ALIASES: Record<string, string> = {
    'pro': AI_MODELS.VIDEO.PRO,
    'fast': AI_MODELS.VIDEO.FAST,
    'edit': AI_MODELS.VIDEO.EDIT,
    'generation': AI_MODELS.VIDEO.GENERATION,
};

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
        durationSeconds,
        hasImage: !!imageInput,
    });

    try {
        // 1. Start the video generation operation
        let operation = await client.models.generateVideos({
            model: modelId,
            prompt: options.prompt,
            ...(imageInput ? { image: imageInput } : {}),
            config: videoConfig as Parameters<typeof client.models.generateVideos>[0]['config'],
        });

        logger.info('[MediaGenerator] Video generation operation started. Polling for completion...');

        // 2. Poll for completion
        const pollInterval = 5000; // 5 seconds
        const maxAttempts = Math.ceil(timeoutMs / pollInterval);
        let attempts = 0;

        while (!operation.done && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            attempts++;

            // Re-poll the operation
            operation = await client.operations.getVideosOperation({
                operation: operation,
            });

            if (attempts % 3 === 0) {
                logger.info(`[MediaGenerator] Video generation poll attempt ${attempts}/${maxAttempts}...`);
            }
        }

        if (!operation.done) {
            throw new AppException(
                AppErrorCode.TIMEOUT,
                `Video generation timed out after ${attempts} poll attempts (${Math.round(timeoutMs / 1000)}s).`
            );
        }

        // 3. Extract the video URL from the typed operation response
        const generatedVideos = operation.response?.generatedVideos;

        if (generatedVideos && generatedVideos.length > 0) {
            const firstVideo = generatedVideos[0]!;
            const videoUri = firstVideo.video?.uri;
            const videoBytes = firstVideo.video?.videoBytes;

            if (videoUri) {
                logger.info(`[MediaGenerator] ✅ Video URI received, fetching bytes for playback: ${videoUri.substring(0, 100)}...`);

                // Native <video> elements cannot attach custom headers (x-goog-api-key).
                // The raw Gemini API URI requires authentication, so we fetch the bytes
                // via an authenticated request and create a blob URL for the browser.
                try {
                    const apiKey = import.meta.env.VITE_API_KEY;
                    const fetchUrl = videoUri.includes('?')
                        ? `${videoUri}&key=${apiKey}`
                        : `${videoUri}?key=${apiKey}`;
                    const videoResponse = await fetch(fetchUrl);
                    if (!videoResponse.ok) {
                        throw new Error(`HTTP ${videoResponse.status}: ${videoResponse.statusText}`);
                    }
                    const videoBlob = await videoResponse.blob();
                    const blobUrl = URL.createObjectURL(videoBlob);
                    logger.info(`[MediaGenerator] ✅ Video ready for playback (blob): ${blobUrl}`);
                    return blobUrl;
                } catch (fetchError: unknown) {
                    logger.warn('[MediaGenerator] Failed to fetch video bytes, falling back to raw URI:', fetchError);
                    // Fall back to raw URI — may still fail in <video> but allows Electron/download paths to work
                    return videoUri;
                }
            }

            // If we got raw bytes instead of a URI, create a blob URL
            if (videoBytes) {
                const mimeType = firstVideo.video?.mimeType || 'video/mp4';
                const byteArray = Uint8Array.from(atob(videoBytes), c => c.charCodeAt(0));
                const blob = new Blob([byteArray], { type: mimeType });
                const blobUrl = URL.createObjectURL(blob);
                logger.info(`[MediaGenerator] ✅ Video generated (blob): ${blobUrl}`);
                return blobUrl;
            }
        }

        // Check for RAI filtering
        if (operation.response?.raiMediaFilteredCount && operation.response.raiMediaFilteredCount > 0) {
            const reasons = operation.response.raiMediaFilteredReasons?.join(', ') || 'content policy violation';
            throw new AppException(
                AppErrorCode.CONTENT_FILTERED,
                `Video was blocked by safety filters: ${reasons}. Try a different prompt.`
            );
        }

        // Check for error in the operation
        if (operation.error) {
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                `Video generation failed: ${JSON.stringify(operation.error)}`
            );
        }

        throw new AppException(
            AppErrorCode.INTERNAL_ERROR,
            'Video generation completed but no video data was returned.'
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
