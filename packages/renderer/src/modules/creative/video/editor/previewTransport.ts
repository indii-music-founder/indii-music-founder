/**
 * Preview transport — engine-free playback control for the video editor.
 *
 * Founder-directed legacy-engine removal: the active <video> element registers
 * itself here; transport actions (play/pause/seek) drive it directly.
 */

let active: HTMLVideoElement | null = null;

export const attachPreviewElement = (el: HTMLVideoElement | null): void => {
    active = el;
};

export const detachPreviewElement = (el: HTMLVideoElement | null): void => {
    if (active === el) active = null;
};

export const previewPlay = async (): Promise<void> => {
    if (!active) return;
    try { await active.play(); } catch { /* autoplay policies — user gesture will retry */ }
};

export const previewPause = (): void => {
    active?.pause();
};

/** Frame-accurate-enough seek: frame → seconds via project fps. */
export const previewSeekToFrame = (frame: number, fps: number): void => {
    if (!active || !Number.isFinite(frame)) return;
    active.currentTime = Math.max(0, frame / (fps || 30));
};

export const hasActivePreviewElement = (): boolean => active !== null;
