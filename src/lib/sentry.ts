import { logger } from '@/utils/logger';
/**
 * Sentry Error Tracking Initialization
 *
 * This module initializes Sentry for production error tracking.
 * Errors are only sent in production builds with a valid DSN configured.
 */
import * as Sentry from '@sentry/react';

export function initSentry(): void {
    // Only initialize in production builds unless debug flag is set
    if (import.meta.env.DEV && !import.meta.env.VITE_DEBUG_SENTRY) {
        return;
    }

    if (import.meta.env.DEV) {
        logger.debug('[Sentry] Initializing in Development Mode for testing purposes.');
    }

    const dsn = import.meta.env.VITE_SENTRY_DSN;

    // SECURITY (Item 246): DSN must come from environment — no hardcoded fallback.
    // In CI, set VITE_SENTRY_DSN. If missing, Sentry is silently disabled.
    if (!dsn) {
        if (import.meta.env.PROD) {
            logger.error('[Sentry] VITE_SENTRY_DSN is not set. Sentry will NOT initialize. Set it in .env or CI secrets.');
        }
        return;
    }

    try {
        Sentry.init({
            dsn,
            // Setting this option to true will send default PII data to Sentry.
            // For example, automatic IP address collection on events
            sendDefaultPii: true,
            environment: import.meta.env.MODE,
            release: `indii-os@${import.meta.env.VITE_APP_VERSION || '0.0.0'}`,

            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration({
                    maskAllText: true,
                    blockAllMedia: true,
                }),
            ],

            // Performance Monitoring - sample 100% of transactions for testing
            tracesSampleRate: 1.0,

            // Session Replay - 100% of sessions for testing
            replaysSessionSampleRate: 1.0,
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

        logger.debug('[Sentry] Initialized for production');
    } catch (error: unknown) {
        logger.error('[Sentry] Initialization failed:', error);
    }
}

// Re-export Sentry for use in other modules
export { Sentry };
