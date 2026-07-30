import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/utils/logger';
import type { SonicBridgeBounce } from '@/types/electron';

/**
 * Sonic Bridge — watch a DAW bounce folder and receive new audio as it lands.
 *
 * ISSUE-1283: the Electron main-process handlers for this shipped long ago but were
 * never exposed through preload, so the feature was unreachable. This hook is the
 * renderer half.
 *
 * Electron-only by nature (it needs a native folder picker and a filesystem
 * watcher). `isAvailable` is false in the browser build; callers should hide or
 * disable the affordance rather than letting it fail on click.
 */
export function useSonicBridge(options?: { onNewBounce?: (bounce: SonicBridgeBounce) => void }) {
    const isAvailable = typeof window !== 'undefined' && !!window.electronAPI?.sonicBridge;

    const [watchedPath, setWatchedPath] = useState<string | null>(null);
    const [bounces, setBounces] = useState<SonicBridgeBounce[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // Held in a ref so changing the callback doesn't tear down and re-add the
    // IPC listener on every render.
    const onNewBounceRef = useRef(options?.onNewBounce);
    useEffect(() => { onNewBounceRef.current = options?.onNewBounce; }, [options?.onNewBounce]);

    useEffect(() => {
        const bridge = window.electronAPI?.sonicBridge;
        if (!bridge) return;

        const unsubscribe = bridge.onNewBounce((bounce) => {
            logger.info('[SonicBridge] New bounce detected:', bounce.name);
            setBounces(prev => [bounce, ...prev]);
            onNewBounceRef.current?.(bounce);
        });

        return () => {
            try {
                unsubscribe?.();
            } catch (err) {
                logger.warn('[SonicBridge] Failed to remove bounce listener:', err);
            }
        };
    }, []);

    const watchFolder = useCallback(async () => {
        const bridge = window.electronAPI?.sonicBridge;
        if (!bridge) {
            setError('Sonic Bridge is only available in the indii desktop app.');
            return null;
        }

        setBusy(true);
        setError(null);
        try {
            const result = await bridge.watchFolder();
            if (!result.success) {
                // A cancelled folder picker is a normal user action, not an error.
                if (result.error && result.error !== 'Cancelled') {
                    setError(result.error);
                }
                return null;
            }
            setWatchedPath(result.path ?? null);
            return result.path ?? null;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('[SonicBridge] watchFolder failed:', err);
            setError(message);
            return null;
        } finally {
            setBusy(false);
        }
    }, []);

    const stopWatching = useCallback(async () => {
        const bridge = window.electronAPI?.sonicBridge;
        if (!bridge) return;

        setBusy(true);
        try {
            await bridge.stopWatching();
            setWatchedPath(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('[SonicBridge] stopWatching failed:', err);
            setError(message);
        } finally {
            setBusy(false);
        }
    }, []);

    return { isAvailable, watchedPath, bounces, error, busy, watchFolder, stopWatching };
}
