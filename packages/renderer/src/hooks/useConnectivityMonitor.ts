import { useEffect } from 'react';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';

/**
 * Monitor actual connectivity in Electron apps.
 * navigator.onLine is unreliable in Electron — this hook periodically
 * verifies real connectivity by pinging a reliable endpoint.
 *
 * Fixes stuck "offline" state by detecting when the actual network works.
 */
export function useConnectivityMonitor() {
    const setIsOffline = useStore(state => state.setIsOffline);

    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        let isCheckInFlight = false;

        const checkConnectivity = async () => {
            // Avoid overlapping checks
            if (isCheckInFlight) return;
            isCheckInFlight = true;

            try {
                // First, try navigator.onLine (fast, unreliable)
                const navOnline = navigator.onLine;

                // If navigator says we're online, trust it (common case)
                if (navOnline) {
                    setIsOffline(false);
                    isCheckInFlight = false;
                    return;
                }

                // navigator says offline — verify with a real fetch
                // Use a minimal HEAD request to Google DNS or a reliable endpoint
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                try {
                    const response = await fetch('https://www.google.com/generate_204', {
                        method: 'HEAD',
                        mode: 'no-cors',
                        cache: 'no-store',
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    // 204 or any non-5xx response = actually online
                    const isActuallyOnline = !response.ok || response.status < 500;
                    setIsOffline(!isActuallyOnline);

                    if (isActuallyOnline && !navOnline) {
                        logger.warn(
                            '[ConnectivityMonitor] Electron navigator.onLine stuck offline; ' +
                            'actual network verified online. Forcing state update.'
                        );
                    }
                } catch (fetchErr) {
                    clearTimeout(timeoutId);
                    // Fetch failed — likely actually offline
                    if (fetchErr instanceof Error && fetchErr.name !== 'AbortError') {
                        logger.debug('[ConnectivityMonitor] Fetch check failed, confirming offline');
                    }
                    setIsOffline(true);
                }
            } catch (err) {
                logger.error('[ConnectivityMonitor] Unexpected error:', err);
            } finally {
                isCheckInFlight = false;
            }
        };

        // Check every 10 seconds (+ browser online/offline events below)
        checkConnectivity(); // initial check
        intervalId = setInterval(checkConnectivity, 10000);

        // Also listen to browser events as fallback
        const handleOnline = () => {
            setIsOffline(false);
            logger.info('[ConnectivityMonitor] Online event fired');
        };

        const handleOffline = () => {
            setIsOffline(true);
            logger.info('[ConnectivityMonitor] Offline event fired');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            if (intervalId) clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [setIsOffline]);
}
