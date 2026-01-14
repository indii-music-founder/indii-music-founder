/**
 * Sentry Error Tracking Initialization
 *
 * This module initializes Sentry for production error tracking.
 * Errors are only sent in production builds with a valid DSN configured.
 */
import * as Sentry from '@sentry/react';

export function initSentry(): void {
    // Only initialize in production builds
    if (import.meta.env.DEV) {
        console.log('[Sentry] Skipped - Development mode');
        return;
    }

    const dsn = import.meta.env.VITE_SENTRY_DSN;

    if (!dsn) {
        console.warn('[Sentry] No DSN configured - Error tracking disabled');
        return;
    }

    try {
        Sentry.init({
            dsn,
            environment: import.meta.env.MODE,
            release: `indii-os@${import.meta.env.VITE_APP_VERSION || '0.0.0'}`,

            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration({
                    maskAllText: true,
                    blockAllMedia: true,
                }),
            ],

            // Performance Monitoring - sample 10% of transactions
            tracesSampleRate: 0.1,

            // Session Replay - 10% of sessions, 100% on error
            replaysSessionSampleRate: 0.1,
            replaysOnErrorSampleRate: 1.0,

            // Scrub sensitive data before sending
            beforeSend(event) {
                // Remove authorization headers
                if (event.request?.headers) {
                    delete event.request.headers['Authorization'];
                    delete event.request.headers['authorization'];
                }
                return event;
            },

            // Ignore common non-actionable errors
            ignoreErrors: [
                // Resize observer errors (browser-specific, non-critical)
                'ResizeObserver loop',
                'ResizeObserver loop limit exceeded',
                // Network errors that are expected
                'Network request failed',
                'Failed to fetch',
                // Chunk loading errors (handled by ErrorBoundary)
                /^Loading chunk \d+ failed/,
                /^Loading CSS chunk \d+ failed/,
                // User-initiated cancellations
                'AbortError',
                // Non-Error promise rejections
                'Non-Error promise rejection captured',
            ],
        });

        console.log('[Sentry] Initialized for production');
    } catch (error) {
        console.error('[Sentry] Initialization failed:', error);
    }
}

// Re-export Sentry for use in other modules
export { Sentry };
