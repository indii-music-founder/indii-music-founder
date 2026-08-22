/**
 * studioRelayHealth — ground truth for the Studio → cloud presence pipeline.
 *
 * ISSUE (2026-08 session audit, Finding 6): Settings reported "Studio
 * Executor: Ready" based solely on the presence of `window.electronAPI`.
 * That says nothing about whether heartbeats actually land: a stale or
 * missing cloud-function deploy, a keychain/lease failure, or App Check /
 * quota rejection all surfaced only as a stripped console warning while the
 * paired phone saw "no Studio online". These trackers record what the
 * publish loop actually observed so the desktop UI can tell the truth.
 *
 * Pure module (no Firebase imports) so the classification stays unit-testable.
 */

export interface StudioRelayHealth {
    /** Local ms timestamp of the most recent publish attempt. */
    lastAttemptAtMs: number | null;
    /** Local ms timestamp of the most recent confirmed publish. */
    lastSuccessAtMs: number | null;
    /** Message from the most recent failure, cleared on the next success. */
    lastErrorMessage: string | null;
    /** Failed publishes in a row since the last success. */
    consecutiveFailures: number;
}

export type StudioRelayStatus = 'idle' | 'live' | 'failing';

export interface StudioRelayVerdict {
    status: StudioRelayStatus;
    /** Human-readable one-liner for the settings row. */
    detail: string;
}

const EMPTY_HEALTH: StudioRelayHealth = {
    lastAttemptAtMs: null,
    lastSuccessAtMs: null,
    lastErrorMessage: null,
    consecutiveFailures: 0,
};

let health: StudioRelayHealth = { ...EMPTY_HEALTH };

/** How fresh a success must be to call the heartbeat "live". The desktop loop publishes every ~5s and background throttling stretches that to ~60s. */
export const STUDIO_RELAY_LIVE_WINDOW_MS = 70_000;

export function recordPresencePublishAttempt(now = Date.now()): void {
    health.lastAttemptAtMs = now;
}

export function recordPresencePublishSuccess(now = Date.now()): void {
    health.lastSuccessAtMs = now;
    health.lastErrorMessage = null;
    health.consecutiveFailures = 0;
}

export function recordPresencePublishFailure(error: unknown): void {
    health.lastErrorMessage = error instanceof Error ? error.message : String(error);
    health.consecutiveFailures += 1;
}

export function getStudioRelayHealth(): StudioRelayHealth {
    return { ...health };
}

export function resetStudioRelayHealth(): void {
    health = { ...EMPTY_HEALTH };
}

function formatAge(ms: number): string {
    const seconds = Math.max(0, Math.round(ms / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
}

/**
 * Reduce the raw counters to the three states a user can act on:
 *   live    — a publish landed recently; pairing will succeed.
 *   failing — publishes are being attempted and rejected; the message says why.
 *   idle    — the executor has not tried yet this session.
 */
export function classifyStudioRelayHealth(
    snapshot: StudioRelayHealth,
    now = Date.now(),
    liveWindowMs = STUDIO_RELAY_LIVE_WINDOW_MS
): StudioRelayVerdict {
    if (
        snapshot.lastSuccessAtMs !== null &&
        now - snapshot.lastSuccessAtMs <= liveWindowMs &&
        snapshot.consecutiveFailures === 0
    ) {
        return { status: 'live', detail: `Heartbeat received ${formatAge(now - snapshot.lastSuccessAtMs)}.` };
    }

    if (snapshot.lastErrorMessage !== null) {
        return { status: 'failing', detail: snapshot.lastErrorMessage };
    }

    if (snapshot.lastSuccessAtMs !== null) {
        return { status: 'failing', detail: `Last heartbeat ${formatAge(now - snapshot.lastSuccessAtMs)} — newer publishes have not confirmed.` };
    }

    return { status: 'idle', detail: 'No heartbeat published yet this session.' };
}
