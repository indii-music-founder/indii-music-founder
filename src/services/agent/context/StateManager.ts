import { useStore } from '@/core/store';
import { StoreState } from '@/core/store';

/**
 * Manages state snapshots for rollback capabilities.
 * Uses JSON serialization for deep cloning state slices.
 */
export class StateManager {
    private snapshots: Map<string, Partial<StoreState>> = new Map();

    /**
     * Captures a snapshot of the current store state.
     * @param transactionId Unique ID for the transaction
     * @param slices Optional list of specific slices to capture (defaults to all safe slices)
     */
    captureSnapshot(transactionId: string, slices: (keyof StoreState)[] = []) {
        const state = useStore.getState();
        const snapshot: Partial<StoreState> = {};

        const keysToCapture = slices.length > 0
            ? slices
            : Object.keys(state) as (keyof StoreState)[];

        keysToCapture.forEach(key => {
            const value = state[key];
            // Skip functions and internal Zustand methods
            if (typeof value === 'function') return;

            try {
                // Phase 3 Improvement: Use structuredClone for true deep cloning
                // Falls back to JSON if structuredClone isn't available or fails
                if (typeof structuredClone === 'function') {
                    (snapshot as any)[key] = structuredClone(value);
                } else {
                    (snapshot as any)[key] = JSON.parse(JSON.stringify(value));
                }
            } catch (e) {
                console.warn(`[StateManager] Failed to deep clone slice ${String(key)}. Falling back to JSON/shallow.`, e);
                try {
                    snapshot[key] = JSON.parse(JSON.stringify(value));
                } catch (jsonErr) {
                    // Final fallback to shallow copy if all else fails
                    snapshot[key] = value as any;
                }
            }
        });

        // Prevent unintentional mutations of the snapshot
        const frozenSnapshot = Object.freeze(snapshot);
        this.snapshots.set(transactionId, frozenSnapshot);
        console.debug(`[StateManager] Snapshot captured for ${transactionId}`);
    }

    /**
     * Restores state from a snapshot.
     */
    restoreSnapshot(transactionId: string) {
        const snapshot = this.snapshots.get(transactionId);
        if (snapshot) {
            console.warn(`[StateManager] Restoring snapshot for ${transactionId}`);
            useStore.setState(snapshot);
            this.snapshots.delete(transactionId);
        } else {
            console.warn(`[StateManager] No snapshot found for ${transactionId}`);
        }
    }

    /**
     * Discards a snapshot (commit).
     */
    discardSnapshot(transactionId: string) {
        if (this.snapshots.has(transactionId)) {
            this.snapshots.delete(transactionId);
            console.debug(`[StateManager] Snapshot discarded (committed) for ${transactionId}`);
        }
    }

    /**
     * Checks if a snapshot exists (for testing).
     */
    hasSnapshot(transactionId: string): boolean {
        return this.snapshots.has(transactionId);
    }
}
