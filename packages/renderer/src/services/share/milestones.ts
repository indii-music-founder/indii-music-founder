/**
 * Milestone bookkeeping: each milestone celebrates once per user per device.
 *
 * Keys follow the per-user localStorage pattern used elsewhere in the studio
 * (`indii:<thing>:<uid>`). Storage failures (private mode, blocked storage)
 * never throw: we simply skip the celebration rather than risk repeating it.
 */
export type MilestoneKey = 'first-release-delivered' | 'first-track-analyzed';

const SOUND_PREF_KEY = 'indii:milestone-sound';

function storageKey(key: MilestoneKey, userId: string): string {
    return `indii:milestone:${key}:${userId || 'anonymous'}`;
}

/**
 * Returns true exactly once per (milestone, user, device) — the caller should
 * celebrate only when this returns true. Returns false if storage is unusable.
 */
export function claimMilestone(key: MilestoneKey, userId: string): boolean {
    try {
        const id = storageKey(key, userId);
        if (window.localStorage.getItem(id)) return false;
        window.localStorage.setItem(id, new Date().toISOString());
        return true;
    } catch {
        return false;
    }
}

export function isMilestoneSoundEnabled(): boolean {
    try {
        return window.localStorage.getItem(SOUND_PREF_KEY) === 'on';
    } catch {
        return false;
    }
}

export function setMilestoneSoundEnabled(enabled: boolean): void {
    try {
        window.localStorage.setItem(SOUND_PREF_KEY, enabled ? 'on' : 'off');
    } catch {
        // Preference is best-effort.
    }
}

/**
 * The indii sonic logo: a short rising major arpeggio with a soft tail,
 * synthesized at runtime (no audio asset). Silent unless the artist opted in.
 */
export function playSonicLogo(): void {
    if (!isMilestoneSoundEnabled()) return;
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    try {
        const ctx = new AudioCtx();
        const master = ctx.createGain();
        master.gain.value = 0.18;
        master.connect(ctx.destination);
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
        notes.forEach((freq, i) => {
            const start = ctx.currentTime + i * 0.09;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = i === notes.length - 1 ? 'sine' : 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(1, start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, start + (i === notes.length - 1 ? 0.9 : 0.35));
            osc.connect(gain).connect(master);
            osc.start(start);
            osc.stop(start + 1);
        });
        window.setTimeout(() => void ctx.close().catch(() => undefined), 1600);
    } catch {
        // Audio is decoration; never let it break the moment.
    }
}
