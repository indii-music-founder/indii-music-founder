import { useEffect, useRef, useCallback } from 'react';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { events } from '@/core/events';

/**
 * Periodically verifies that the user's Firebase Auth token is still valid.
 * If the token cannot be refreshed (expired refresh token, revoked session),
 * emits a SYSTEM_ALERT to surface a re-authentication prompt.
 *
 * Prevents "silent death" where all Firestore/Cloud Function calls fail
 * with "Missing or insufficient permissions" or 401 errors after a session
 * goes stale mid-use (e.g., user leaves tab open for days).
 *
 * @param intervalMs How often to check (default: 5 minutes)
 */
export function useAuthHealth(intervalMs = 5 * 60 * 1000): void {
    const hasNotified = useRef(false);

    const checkHealth = useCallback(async () => {
        if (!auth.currentUser) return;

        try {
            await auth.currentUser.getIdToken(/* forceRefresh */ false);
            if (hasNotified.current) {
                logger.info('[AuthHealth] Session recovered — token refresh succeeded.');
                hasNotified.current = false;
            }
        } catch (error: unknown) {
            const errorCode = (error as { code?: string })?.code || '';
            const message = error instanceof Error ? error.message : String(error);
            const isNetworkError =
                errorCode === 'auth/network-request-failed' ||
                message.includes('network-request-failed') ||
                message.includes('ERR_CONNECTION_CLOSED') ||
                message.includes('Failed to fetch');

            if (isNetworkError) {
                // Transient network disruption is not an expired session — do not alarm user
                logger.warn('[AuthHealth] Token refresh encountered network interruption, will retry next interval:', message);
                return;
            }

            if (!hasNotified.current) {
                hasNotified.current = true;
                logger.warn('[AuthHealth] Token refresh failed (session invalid):', message);
                events.emit('SYSTEM_ALERT', {
                    level: 'warning' as const,
                    message: 'Your session has expired. Please sign in again to continue using all features.'
                });
            }
        }
    }, []);

    useEffect(() => {
        // Give Firebase SDK time to hydrate from IndexedDB before first check
        const initialTimer = setTimeout(checkHealth, 3000);
        const intervalId = setInterval(checkHealth, intervalMs);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(intervalId);
        };
    }, [checkHealth, intervalMs]);
}
