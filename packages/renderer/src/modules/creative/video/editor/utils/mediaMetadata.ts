/**
 * Extract duration in seconds from a media file (audio or video) using Web Audio API.
 * Uses browser's native media loading without requiring FFmpeg.
 */
export async function getMediaDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    try {
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');

      if (!isVideo && !isAudio) {
        // For images or unsupported types, use default
        resolve(0);
        return;
      }

      const element = isVideo ? document.createElement('video') : document.createElement('audio');
      const url = URL.createObjectURL(file);
      element.src = url;

      const cleanup = () => URL.revokeObjectURL(url);

      element.onloadedmetadata = () => {
        cleanup();
        resolve(element.duration);
      };

      element.onerror = () => {
        cleanup();
        resolve(0);
      };

      // Set timeout to prevent hanging
      const timeout = setTimeout(() => {
        cleanup();
        resolve(0);
      }, 5000);

      element.onloadedmetadata = () => {
        clearTimeout(timeout);
        cleanup();
        resolve(element.duration);
      };

      element.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        resolve(0);
      };
    } catch {
      resolve(0);
    }
  });
}

/**
 * Convert duration in seconds to frames at a given FPS.
 */
export function durationSecondsToFrames(durationSeconds: number, fps: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 150; // Default fallback
  if (!Number.isFinite(fps) || fps <= 0) fps = 30;
  return Math.max(1, Math.round(durationSeconds * fps));
}
