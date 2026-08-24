/**
 * Playback control shared by rendered artifacts and the seekable HyperFrames
 * Player preview. The editor never reaches into engine internals.
 */

export interface PreviewTransportElement {
    play: () => void | Promise<void>;
    pause: () => void;
    seek?: (seconds: number) => void;
    currentTime: number;
}

let active: PreviewTransportElement | null = null;

export const attachPreviewElement = (el: PreviewTransportElement | null): void => {
    active = el;
};

export const detachPreviewElement = (el: PreviewTransportElement | null): void => {
    if (active === el) active = null;
};

export const previewPlay = async (): Promise<void> => {
    if (!active) return;
    try { await Promise.resolve(active.play()); } catch { /* user gesture will retry */ }
};

export const previewPause = (): void => {
    active?.pause();
};

/** Frame-accurate-enough seek: frame → seconds via project fps. */
export const previewSeekToFrame = (frame: number, fps: number): void => {
    if (!active || !Number.isFinite(frame)) return;
    const seconds = Math.max(0, frame / (fps || 30));
    if (active.seek) active.seek(seconds);
    else active.currentTime = seconds;
};

export const hasActivePreviewElement = (): boolean => active !== null;
