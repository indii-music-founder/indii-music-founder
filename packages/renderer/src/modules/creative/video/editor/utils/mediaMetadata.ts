import { httpsCallable } from 'firebase/functions';
import { functionsWest1 } from '@/services/firebase';
import { logger } from '@/utils/logger';

const PROBE_TIMEOUT_MS = 8000;

/**
 * Extract duration in seconds from a local media File using a hidden
 * <video>/<audio> element. Browser-native, no network/backend round trip.
 * Resolves 0 for non-media files or on failure/timeout.
 */
export async function getMediaDurationFromFile(file: File): Promise<number> {
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');
  if (!isVideo && !isAudio) return 0;

  const url = URL.createObjectURL(file);
  try {
    return await probeElementDuration(isVideo ? 'video' : 'audio', url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Extract duration in seconds directly from a remote media URL (e.g. a
 * Firebase Storage download URL) using a hidden <video>/<audio> element.
 * HTMLMediaElement.duration is not a CORS-restricted property, so this works
 * cross-origin without special headers. Resolves 0 on failure/timeout.
 */
export async function getMediaDurationFromUrl(url: string, mediaType: 'video' | 'audio' | 'image'): Promise<number> {
  if (mediaType === 'image') return 0;
  return probeElementDuration(mediaType, url);
}

function probeElementDuration(kind: 'video' | 'audio', src: string): Promise<number> {
  return new Promise((resolve) => {
    const element = document.createElement(kind);
    element.preload = 'metadata';
    element.src = src;

    let settled = false;
    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      element.removeAttribute('src');
      element.load();
      resolve(value);
    };

    const timeoutId = setTimeout(() => finish(0), PROBE_TIMEOUT_MS);

    element.onloadedmetadata = () => {
      // Some streamed/opaque sources report Infinity until a seek trick is
      // performed; treat non-finite durations as an unresolved probe rather
      // than a real value.
      finish(Number.isFinite(element.duration) ? element.duration : 0);
    };
    element.onerror = () => finish(0);
  });
}

/**
 * Resolve the authoritative duration (seconds) of an already-uploaded Storage
 * asset via the backend `getMediaDuration` callable, which runs ffprobe
 * against the real file. Used as a fallback when the client-side probe can't
 * produce a finite duration (e.g. streamed uploads without Content-Length).
 * Returns 0 on any failure — callers must treat 0 as "unresolved."
 */
export async function getMediaDurationFromBackend(storageUri: string): Promise<number> {
  try {
    const call = httpsCallable<{ uri: string }, { durationSeconds: number }>(functionsWest1, 'getMediaDuration');
    const result = await call({ uri: storageUri });
    const duration = result.data?.durationSeconds;
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  } catch (error: unknown) {
    logger.warn('[mediaMetadata] Backend duration probe failed:', error);
    return 0;
  }
}

/**
 * Returns true if a URL is a Storage reference our backend `getMediaDuration`
 * callable can resolve (gs:// or a Firebase/Google Storage download URL).
 * Blob/data/arbitrary external URLs are not eligible for the backend fallback.
 */
export function isBackendResolvableStorageUri(url: string): boolean {
  if (url.startsWith('gs://')) return true;
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'firebasestorage.googleapis.com' || parsed.hostname === 'storage.googleapis.com';
  } catch {
    return false;
  }
}

/**
 * Full resolution pipeline for a remote (already-uploaded) media asset:
 * 1. Try the fast client-side media-element probe.
 * 2. If that fails to produce a finite duration and the URL is a Storage
 *    reference, fall back to the authoritative backend ffprobe callable.
 * 3. If both fail, returns 0 — caller applies its own documented default.
 */
export async function resolveMediaDurationSeconds(url: string, mediaType: 'video' | 'audio' | 'image'): Promise<number> {
  if (mediaType === 'image') return 0;

  const clientDuration = await getMediaDurationFromUrl(url, mediaType);
  if (clientDuration > 0) return clientDuration;

  if (isBackendResolvableStorageUri(url)) {
    return getMediaDurationFromBackend(url);
  }

  return 0;
}

/**
 * Convert duration in seconds to frames at a given FPS. When duration cannot
 * be determined, callers pass 0 and get the documented fallback below rather
 * than a silently wrong number.
 */
export function durationSecondsToFrames(durationSeconds: number, fps: number, fallbackFrames = 150): number {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return fallbackFrames;
  return Math.max(1, Math.round(durationSeconds * safeFps));
}
