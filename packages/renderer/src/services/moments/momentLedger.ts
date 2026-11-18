/**
 * Per-user Moment celebration ledger backed by localStorage.
 *
 * Ensures each `uid:eventKey` celebration (such as pre-save fan count
 * thresholds) fires only once per user across sessions.
 */

export const PRESAVE_FAN_THRESHOLDS = [1, 10, 50, 100, 500, 1000] as const;

const LEDGER_KEY_PREFIX = 'indii:moment-ledger:';

function readLedger(uid: string): Record<string, number> {
    if (typeof localStorage === 'undefined' || !uid) return {};
    try {
        const raw = localStorage.getItem(`${LEDGER_KEY_PREFIX}${uid}`);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {};
        }
        return parsed as Record<string, number>;
    } catch {
        return {};
    }
}

function writeLedger(uid: string, ledger: Record<string, number>): void {
    if (typeof localStorage === 'undefined' || !uid) return;
    try {
        localStorage.setItem(`${LEDGER_KEY_PREFIX}${uid}`, JSON.stringify(ledger));
    } catch {
        // Private mode or storage quota exceeded — degrade gracefully.
    }
}

/**
 * Builds the canonical ledger key for a pre-save campaign fan threshold.
 */
export function presaveThresholdKey(campaignId: string, threshold: number): string {
    return `presave:${campaignId}:fans:${threshold}`;
}

/**
 * Returns true if the given `uid` + `key` has already been celebrated.
 */
export function hasCelebrated(uid: string | null | undefined, key: string): boolean {
    if (!uid || !key) return false;
    const ledger = readLedger(uid);
    return Object.prototype.hasOwnProperty.call(ledger, key);
}

/**
 * Records that `uid` has celebrated `key`.
 */
export function markCelebrated(uid: string | null | undefined, key: string): void {
    if (!uid || !key) return;
    const ledger = readLedger(uid);
    if (Object.prototype.hasOwnProperty.call(ledger, key)) return;
    ledger[key] = Date.now();
    writeLedger(uid, ledger);
}

/**
 * Returns the highest pre-save fan threshold in `PRESAVE_FAN_THRESHOLDS`
 * reached by `count` if it has not yet been celebrated, or `null` otherwise.
 */
export function nextUncelebratedThreshold(
    uid: string | null | undefined,
    campaignId: string,
    count: number,
): number | null {
    if (!uid || !campaignId || !Number.isFinite(count) || count < 1) {
        return null;
    }

    let highestCrossed: number | null = null;
    for (const threshold of PRESAVE_FAN_THRESHOLDS) {
        if (count >= threshold) {
            highestCrossed = threshold;
        }
    }

    if (highestCrossed === null) {
        return null;
    }

    const key = presaveThresholdKey(campaignId, highestCrossed);
    return hasCelebrated(uid, key) ? null : highestCrossed;
}
