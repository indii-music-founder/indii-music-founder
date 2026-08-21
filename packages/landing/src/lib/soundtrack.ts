'use client';

/**
 * Loads a soundtrack asset with a hard timeout so a hung asset fetch can
 * never stall the audio experience indefinitely.
 *
 * Returns `{ url, audio }` when the response is a playable audio asset, or
 * `null` when the server answered with something that is not audio (e.g. the
 * app shell for an unknown asset path). The caller owns the object URL and
 * must revoke it when playback stops or fails.
 */

export const SOUNDTRACK_FETCH_TIMEOUT_MS = 15000;

export interface LoadedSoundtrack {
    url: string;
    audio: HTMLAudioElement;
}

export async function loadSoundtrackSource(
    source: string,
    options?: { timeoutMs?: number },
): Promise<LoadedSoundtrack | null> {
    const timeoutMs = options?.timeoutMs ?? SOUNDTRACK_FETCH_TIMEOUT_MS;

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
        response = await fetch(source, { cache: 'no-store', signal: controller.signal });
    } finally {
        window.clearTimeout(timer);
    }

    const contentType = response.headers.get('content-type') ?? '';

    // Vite may return the app shell for an unknown asset, so verify that
    // the response is actually audio before trying to play it.
    if (!response.ok || !contentType.startsWith('audio/')) return null;

    const soundtrackBlob = await response.blob();
    const url = URL.createObjectURL(soundtrackBlob);
    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.72;
    return { url, audio };
}
