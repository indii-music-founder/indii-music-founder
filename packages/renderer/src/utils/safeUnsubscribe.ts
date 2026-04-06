/**
 * safeUnsubscribe — Firestore SDK 12.10.0 Crash Guard
 *
 * Wraps a Firestore `onSnapshot` unsubscribe function in a try-catch to prevent
 * the `FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)` crash.
 *
 * Root Cause:
 * When React unmounts a component during rapid module switching, the Firestore
 * SDK's WatchChangeAggregator can throw an internal assertion error during
 * listener teardown. This is a known SDK race condition (b815 / ca9).
 *
 * This utility silently catches these internal assertion errors during cleanup,
 * preventing them from propagating to React's error boundary and crashing the app.
 *
 * Usage:
 * ```ts
 * return () => {
 *   safeUnsubscribe(unsubscribeStats);
 *   safeUnsubscribe(unsubscribeCampaigns);
 * };
 * ```
 */
export function safeUnsubscribe(unsubscribe: (() => void) | undefined): void {
    if (!unsubscribe) return;
    try {
        unsubscribe();
    } catch (__e: unknown) {
        // Firestore SDK internal assertion race condition during rapid unmount.
        // Safe to swallow — the listener is being torn down regardless.
    }
}
