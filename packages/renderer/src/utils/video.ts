/**
 * Video Frame Extraction Utilities
 *
 * Used by the Daisy Chain engine to extract first/last frames from generated segments
 * and feed them into the next generation cycle for visual continuity.
 */
import { resolveStorageUrl } from '@/services/storage/resolveStorageUrl';

export type VideoFramePosition = 'first' | 'last' | number;

export type VideoFrameExtractionStage = 'loading' | 'seeking' | 'capturing' | 'complete';

export interface VideoFrameExtractionOptions {
    fps?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
    maxDataUriBytes?: number;
    onProgress?: (update: { stage: VideoFrameExtractionStage; progress: number }) => void;
}

export interface VideoFrameExtractionResult {
    dataUrl: string;
    mimeType: string;
    timestampSeconds: number;
}

function estimateDataUriBytes(uri: string): number {
    const base64Index = uri.indexOf('base64,');
    if (base64Index === -1) return 0;
    const payload = uri.slice(base64Index + 'base64,'.length);
    return Math.floor((payload.length * 3) / 4);
}

function emitProgress(
    onProgress: VideoFrameExtractionOptions['onProgress'] | undefined,
    stage: VideoFrameExtractionStage,
    progress: number
) {
    onProgress?.({ stage, progress });
}

/**
 * Extract a frame from a video at a specific time position.
 * Returns a data URL (JPEG at 90% quality).
 *
 * @param videoUrl - URL or blob URL of the video
 * @param position - 'first' (0.1s from start) or 'last' (0.1s from end) or a specific time in seconds
 */
export async function extractVideoFrameAt(
    videoUrl: string,
    timestampSeconds: number,
    options: VideoFrameExtractionOptions = {}
): Promise<VideoFrameExtractionResult> {
    const playableUrl = await resolveStorageUrl(videoUrl);
    const maxDataUriBytes = options.maxDataUriBytes ?? 25 * 1024 * 1024;

    if (playableUrl.startsWith('data:') && estimateDataUriBytes(playableUrl) > maxDataUriBytes) {
        throw new Error(`Video is too large for browser-side extraction (${Math.round(maxDataUriBytes / (1024 * 1024))}MB limit). Trim the clip or use a smaller source.`);
    }

    if (options.signal?.aborted) {
        throw new Error('Operation cancelled');
    }

    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.src = playableUrl;
        video.muted = true;
        video.playsInline = true;

        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

        const cleanup = () => {
            if (settled) return;
            settled = true;
            if (timeoutId) clearTimeout(timeoutId);
            video.pause();
            video.removeAttribute('src');
            video.load();
            video.remove();
        };

        const rejectWith = (error: Error) => {
            cleanup();
            reject(error);
        };

        const abortHandler = () => rejectWith(new Error('Operation cancelled'));
        options.signal?.addEventListener('abort', abortHandler, { once: true });

        const frameRate = Math.max(1, options.fps ?? 24);
        const frameDuration = 1 / frameRate;

        timeoutId = setTimeout(() => {
            options.signal?.removeEventListener('abort', abortHandler);
            rejectWith(new Error('Video frame extraction timed out after 15s'));
        }, options.timeoutMs ?? 15000);

        video.onloadedmetadata = () => {
            try {
                const duration = Number.isFinite(video.duration) ? video.duration : 0;
                if (!duration || duration <= 0) {
                    throw new Error('Video duration unavailable.');
                }

                const alignedTimestamp = Math.max(
                    0,
                    Math.min(
                        duration - frameDuration,
                        Math.round(timestampSeconds * frameRate) / frameRate
                    )
                );

                emitProgress(options.onProgress, 'loading', 20);
                emitProgress(options.onProgress, 'seeking', 55);
                video.currentTime = alignedTimestamp;
            } catch (error) {
                options.signal?.removeEventListener('abort', abortHandler);
                rejectWith(error instanceof Error ? error : new Error(String(error)));
            }
        };

        video.onseeked = async () => {
            try {
                emitProgress(options.onProgress, 'capturing', 85);
                await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    throw new Error('Could not get canvas context');
                }

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

                options.signal?.removeEventListener('abort', abortHandler);
                emitProgress(options.onProgress, 'complete', 100);
                cleanup();
                resolve({
                    dataUrl,
                    mimeType: 'image/jpeg',
                    timestampSeconds: Math.max(0, video.currentTime),
                });
            } catch (error) {
                options.signal?.removeEventListener('abort', abortHandler);
                rejectWith(error instanceof Error ? error : new Error(String(error)));
            }
        };

        video.onerror = (e) => {
            options.signal?.removeEventListener('abort', abortHandler);
            rejectWith(new Error(`Video loading error: ${String(e)}`));
        };
    });
}

export async function extractVideoFrame(
    videoUrl: string,
    position: VideoFramePosition = 'last',
    options: VideoFrameExtractionOptions = {}
): Promise<string> {
    const playableUrl = await resolveStorageUrl(videoUrl);
    const meta = await new Promise<{ duration: number }>((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = playableUrl;
        video.muted = true;
        video.playsInline = true;
        video.onloadedmetadata = () => {
            resolve({ duration: Number.isFinite(video.duration) ? video.duration : 0 });
            video.removeAttribute('src');
            video.load();
            video.remove();
        };
        video.onerror = () => reject(new Error('Failed to load video metadata.'));
    });

    const frameRate = Math.max(1, options.fps ?? 24);
    const frameDuration = 1 / frameRate;
    const seekTime = position === 'first'
        ? frameDuration
        : position === 'last'
            ? Math.max(0, meta.duration - frameDuration)
            : position;

    const result = await extractVideoFrameAt(videoUrl, seekTime, options);
    return result.dataUrl;
}

/**
 * Extract the last frame of a video in API-ready format.
 * Returns { imageBytes: base64, mimeType: 'image/jpeg' }
 *
 * This is the core primitive of the Daisy Chain engine:
 * Last frame of segment N → firstFrame of segment N+1
 */
export async function extractLastFrameForAPI(videoUrl: string): Promise<{
    imageBytes: string;
    mimeType: string;
    dataUrl: string;
}> {
    const dataUrl = await extractVideoFrame(videoUrl, 'last', { fps: 24 });
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);

    if (!match) {
        throw new Error('Failed to parse frame data URL');
    }

    return {
        imageBytes: match[2]!,
        mimeType: match[1]!,
        dataUrl // Keep the full data URL for UI preview
    };
}

/**
 * Extract the first frame of a video in API-ready format.
 * Useful for the reverse daisy chain (extending backwards).
 */
export async function extractFirstFrameForAPI(videoUrl: string): Promise<{
    imageBytes: string;
    mimeType: string;
    dataUrl: string;
}> {
    const dataUrl = await extractVideoFrame(videoUrl, 'first', { fps: 24 });
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);

    if (!match) {
        throw new Error('Failed to parse frame data URL');
    }

    return {
        imageBytes: match[2]!,
        mimeType: match[1]!,
        dataUrl
    };
}
