/**
 * Firestore Timestamp fields read back as `null`/`undefined` locally until the
 * server acks a `serverTimestamp()` write (or as plain millis after some SDK
 * paths). Calling `.toMillis()` on that transient state throws
 * "X.toMillis is not a function" — this has crashed app boot when a session
 * list loads a doc whose `createdAt` hasn't round-tripped yet.
 */
export function toMillisSafe(value: unknown, fallback: number = 0): number {
    if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
        return (value as { toMillis: () => number }).toMillis();
    }
    if (typeof value === 'number') return value;
    return fallback;
}
