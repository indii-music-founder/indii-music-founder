import { useEffect, useRef, useCallback } from 'react';
import { auth } from '@/services/firebase';
import { Logger } from '@/core/logger/Logger';
import { delay } from '@/utils/async';

const IDLE_WARNING_MS = 55 * 60 * 1000;  // 55 minutes - warn before Firebase token expires (60 min)
const IDLE_LOGOUT_MS = 60 * 60 * 1000;   // 60 minutes - force token refresh or logout
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * Hook to manage session timeout for long-running sessions.
 *
 * - Refreshes Firebase ID token before it expires (every ~55 min of activity)
 * - Shows a warning callback when user is idle approaching timeout
 * - Calls onTimeout if user is completely idle past the limit
 *
 * Firebase ID tokens expire after 1 hour. This hook proactively refreshes
 * them to prevent mid-session auth failures.
 */
export function useSessionTimeout(options?: {
    onWarning?: () => void;
    onTimeout?: () => void;
}) {
    const lastActivity = useRef(0);

    useEffect(() => {
        lastActivity.current = Date.now();
    }, []);
    const warningFired = useRef(false);

    const resetActivity = useCallback(() => {
        lastActivity.current = Date.now();
        warningFired.current = false;
    }, []);

    useEffect(() => {
        // Track user activity
        for (const event of ACTIVITY_EVENTS) {
            window.addEventListener(event, resetActivity, { passive: true });
        }

        let active = true;
        const checkSession = async () => {
            while (active) {
                await delay(60_000); // Check every minute
                if (!active) break;

                const idle = Date.now() - lastActivity.current;

                // Proactive token refresh - if user is active and approaching expiry
                if (idle < IDLE_WARNING_MS && auth.currentUser) {
                    try {
                        await auth.currentUser.getIdToken(true);
                    } catch {
                        Logger.warn('Session', 'Token refresh failed');
                    }
                    continue;
                }

                // Idle warning
                if (idle >= IDLE_WARNING_MS && !warningFired.current) {
                    warningFired.current = true;
                    Logger.info('Session', 'User idle, approaching timeout');
                    options?.onWarning?.();
                }

                // Idle timeout
                if (idle >= IDLE_LOGOUT_MS) {
                    Logger.warn('Session', 'Session timed out due to inactivity');
                    options?.onTimeout?.();
                }
            }
        };

        checkSession();

        return () => {
            active = false;
            for (const event of ACTIVITY_EVENTS) {
                window.removeEventListener(event, resetActivity);
            }
        };
    }, [resetActivity, options]);
}
