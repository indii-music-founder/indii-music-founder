import * as Sentry from '@sentry/react';
import { getConsentPreferences } from '@/components/shared/CookieConsentBanner';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENVIRONMENT = import.meta.env.MODE ?? 'development';
const RELEASE = `indiios@${import.meta.env.VITE_APP_VERSION ?? '0.1.0-beta.2'}`;
const DEBUG = import.meta.env.DEV && import.meta.env.VITE_DEBUG_SENTRY === 'true';

/** Initialize Sentry for the React renderer. Call once before ReactDOM.render(). */
export function initSentry(): void {
    // Item 303: Gate Sentry initialization on cookie consent.
    const consent = getConsentPreferences();
    if (!consent?.errorTracking) {
        if (DEBUG) console.log('[Sentry] Initialization skipped: No consent for error tracking.');
        return;
    }

    if (!SENTRY_DSN) {
        if (DEBUG) console.warn('[Sentry] Initialization skipped: No VITE_SENTRY_DSN configured.');
        return;
    }

    if (DEBUG) console.log(`[Sentry] Initializing for ${ENVIRONMENT} (${RELEASE})...`);

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: ENVIRONMENT,
        release: RELEASE,
        // Item 388: 10% traces sampled in production; 100% in staging
        tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
        // Capture 10% of sessions for Session Replay in production
        replaysSessionSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0,
        replaysOnErrorSampleRate: 1.0,
        sendDefaultPii: true, // Allow PII for better debugging, but scrub sensitive headers in beforeSend
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
            }),
        ],
        // Filter out known non-actionable errors and scrub sensitive data
        beforeSend(event) {
            // 1. Scrub sensitive headers from breadcrumbs (Authorization, etc.)
            if (event.breadcrumbs) {
                event.breadcrumbs.forEach((breadcrumb) => {
                    if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
                        const data = breadcrumb.data as Record<string, any> | undefined;
                        if (data?.headers?.Authorization) {
                            data.headers.Authorization = '[REDACTED]';
                        }
                    }
                });
            }

            // 2. Filter out non-actionable errors
            const msg = event.exception?.values?.[0]?.value ?? '';
            if (msg.includes('ResizeObserver loop')) return null;
            if (msg.includes('Non-Error exception captured')) return null;
            if (msg.includes('NetworkError when attempting to fetch resource')) return null;
            
            return event;
        },
        ignoreErrors: [
            // Network errors that aren't actionable
            'NetworkError',
            'Failed to fetch',
            'Load failed',
            'Aborted',
            // Firebase offline mode
            'The client is offline',
            'FirebaseError: [code=unavailable]',
            // Third-party extension noise
            'chrome-extension://',
            'moz-extension://',
        ],
    });

    // Register instance for global debugging if needed
    if (typeof window !== 'undefined') {
        (window as any).__sentryInstance = Sentry;
    }
}

/**
 * Wrap a React component with Sentry's error boundary.
 * Falls back to the provided fallback UI on uncaught errors.
 */
export const withSentryErrorBoundary = Sentry.withErrorBoundary;

/**
 * HOC to wrap the app root with Sentry profiling.
 * Use in main.tsx: const App = withSentryProfiler(AppRoot);
 */
export const withSentryProfiler = Sentry.withProfiler;

/** Set Sentry user context after authentication. */
export function setSentryUser(uid: string, email?: string): void {
    Sentry.setUser({ id: uid, email });
}

/** Clear Sentry user context on logout. */
export function clearSentryUser(): void {
    Sentry.setUser(null);
}

/** Manually capture an exception with optional context. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
    Sentry.withScope((scope) => {
        if (context) scope.setExtras(context);
        Sentry.captureException(error);
    });
}
