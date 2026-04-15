/**
 * Video Frame Extraction Utilities
 *
 * Used by the Daisy Chain engine to extract first/last frames from generated segments
 * and feed them into the next generation cycle for visual continuity.
 */

/**
 * Extract a frame from a video at a specific time position.
 * Returns a data URL (JPEG at 90% quality).
 *
 * @param videoUrl - URL or blob URL of the video
 * @param position - 'first' (0.1s from start) or 'last' (0.1s from end) or a specific time in seconds
 */
export async function extractVideoFrame(
    videoUrl: string,
    position: 'first' | 'last' | number = 'last'
): Promise<string> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;

        const cleanup = () => {
            video.src = '';
            video.load();
            video.remove();
        };

        video.onloadedmetadata = () => {
            let seekTime: number;

            if (position === 'first') {
                seekTime = 0.1; // Slightly after the very start to get a stable frame
            } else if (position === 'last') {
                seekTime = Math.max(0, video.duration - 0.1);
            } else {
                seekTime = Math.min(Math.max(0, position), video.duration);
            }

            video.currentTime = seekTime;
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                cleanup();
                resolve(dataUrl);
            } else {
                cleanup();
                reject(new Error('Could not get canvas context'));
            }
        };

        video.onerror = (e) => {
            cleanup();
            reject(new Error(`Video loading error: ${e}`));
        };

        // Timeout safety — don't hang if the video never loads
        setTimeout(() => {
            cleanup();
            reject(new Error('Video frame extraction timed out after 30s'));
        }, 30000);
    });
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
    const dataUrl = await extractVideoFrame(videoUrl, 'last');
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
    const dataUrl = await extractVideoFrame(videoUrl, 'first');
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
