/**
 * SentryService — Client-side error tracking initialization
 * Item 388: Production error capture with @sentry/react
 *
 * Call initSentry() once at app startup (before rendering).
 * In Electron, also call initElectronSentry() from the main process.
 *
 * DSN is stored in VITE_SENTRY_DSN env variable. If not set, Sentry is
 * disabled (safe for local development and CI without credentials).
 */

import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENVIRONMENT = import.meta.env.MODE ?? 'development';
const RELEASE = `indiios@${import.meta.env.VITE_APP_VERSION ?? '0.1.0-beta.2'}`;

/** Initialize Sentry for the React renderer. Call once before ReactDOM.render(). */
export function initSentry(): void {
    if (!SENTRY_DSN) {
        // No DSN configured — Sentry disabled (safe in dev/test)
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: ENVIRONMENT,
        release: RELEASE,
        // Item 388: 10% traces sampled in production; 100% in staging
        tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
        // Capture 10% of sessions for Session Replay in production
        replaysSessionSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0,
        replaysOnErrorSampleRate: 1.0,
        integrations: [
            Sentry.browserTracingIntegration(),
        ],
        // Filter out known non-actionable errors
        beforeSend(event) {
            // Don't send ResizeObserver loop errors (browser noise)
            const msg = event.exception?.values?.[0]?.value ?? '';
            if (msg.includes('ResizeObserver loop')) return null;
            if (msg.includes('Non-Error exception captured')) return null;
            return event;
        },
        ignoreErrors: [
            // Network errors that aren't actionable
            'NetworkError',
            'Failed to fetch',
            'Load failed',
            // Firebase offline mode
            'The client is offline',
        ],
    });
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
