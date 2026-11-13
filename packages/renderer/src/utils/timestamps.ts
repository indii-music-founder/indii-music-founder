/**
 * Firestore Timestamp fields read back as `null`/`undefined` locally until the
 * server acks a `serverTimestamp()` write (or as plain millis after some SDK
 * paths). Calling `.toMillis()` on that transient state throws
 * "X.toMillis is not a function" — this has crashed app boot when a session
 * list loads a doc whose `createdAt` hasn't round-tripped yet.
 */
export function toMillisSafe(value: unknown, fallback: number = 0): number {
    let millis: unknown = value;
    if (value && typeof value === 'object') {
        const timestamp = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
        if (typeof timestamp.toMillis === 'function') {
            millis = timestamp.toMillis();
        } else {
            const { seconds, nanoseconds } = timestamp;
            if (typeof seconds !== 'number' || !Number.isSafeInteger(seconds) ||
                typeof nanoseconds !== 'number' || !Number.isInteger(nanoseconds) ||
                nanoseconds < 0 || nanoseconds >= 1_000_000_000) return fallback;
            millis = seconds * 1000 + nanoseconds / 1_000_000;
        }
    }
    return typeof millis === 'number' && Number.isFinite(millis) && Math.abs(millis) <= 8.64e15
        ? millis : fallback;
}
