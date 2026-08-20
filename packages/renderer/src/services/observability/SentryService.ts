import { getConsentPreferences } from '@/components/shared/CookieConsentBanner';
import { Logger } from '@/core/logger/Logger';

const TAG = 'SentryService';


const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENVIRONMENT = import.meta.env.MODE ?? 'development';
const RELEASE = `indii@${import.meta.env.VITE_APP_VERSION ?? '0.1.0-beta.2'}`;
const DEBUG = import.meta.env.DEV && import.meta.env.VITE_DEBUG_SENTRY === 'true';

type SentryModule = typeof import('@sentry/react');

/**
 * @sentry/react (~150KB minified) is loaded lazily so it stays out of the
 * startup critical path. Every export below is a facade over a single
 * dynamic import; init is additionally deferred until the browser is idle
 * (requestIdleCallback). Errors raised before Sentry is ready are still
 * handled by the ErrorBoundary UI — they are simply not reported.
 */
let sentryModulePromise: Promise<SentryModule> | null = null;
let initPromise: Promise<SentryModule | null> | null = null;

function loadSentry(): Promise<SentryModule> {
    if (!sentryModulePromise) {
        sentryModulePromise = import('@sentry/react');
    }
    return sentryModulePromise;
}

/** Consent + DSN gate shared by every entry point. */
function isSentryEnabled(): boolean {
    if (!SENTRY_DSN) return false;
    try {
        const consent = getConsentPreferences();
        return Boolean(consent?.errorTracking);
    } catch {
        return false;
    }
}

/**
 * Ensure the Sentry module is loaded and initialized. Callers (facade
 * methods) await this so that events raised before init completes are
 * still delivered once Sentry becomes ready.
 */
function ensureSentry(): Promise<SentryModule | null> {
    if (!isSentryEnabled()) return Promise.resolve(null);
    if (!initPromise) {
        initPromise = loadSentry()
            .then((Sentry) => {
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
                                    const data = breadcrumb.data as Record<string, unknown> | undefined;
                                    const headers = data?.headers as Record<string, unknown> | undefined;
                                    if (headers?.Authorization) {
                                        headers.Authorization = '[REDACTED]';
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

                // Register instance for global debugging / Logger integration
                if (typeof window !== 'undefined') {
                    (window as unknown as Record<string, unknown>).__sentryInstance = Sentry;
                }
                return Sentry;
            })
            .catch((error: unknown) => {
                Logger.warn(TAG, '[Sentry] Initialization failed (non-blocking):', error);
                initPromise = null; // allow a later retry
                return null;
            });
    }
    return initPromise;
}

/** Initialize Sentry for the React renderer. Call once before ReactDOM.render(). */
export function initSentry(): void {
    // Defer the (heavy) module load + init until the browser is idle so the
    // startup critical path stays lean. Callers that raise events earlier
    // (captureException etc.) trigger ensureSentry() themselves and await it.
    if (!isSentryEnabled()) {
        if (DEBUG) Logger.info(TAG, '[Sentry] Initialization skipped: No consent for error tracking.');
        return;
    }
    if (!SENTRY_DSN) {
        if (DEBUG) Logger.warn(TAG, '[Sentry] Initialization skipped: No VITE_SENTRY_DSN configured.');
        return;
    }
    if (DEBUG) Logger.info(TAG, `[Sentry] Initializing for ${ENVIRONMENT} (${RELEASE})...`);

    const start = () => {
        void ensureSentry();
    };
    if (typeof window !== 'undefined' && typeof (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => void }).requestIdleCallback === 'function') {
        (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout?: number }) => void }).requestIdleCallback(start, { timeout: 3000 });
    } else if (typeof window !== 'undefined') {
        window.setTimeout(start, 0);
    }
}

/**
 * Wrap a React component with Sentry's error boundary.
 * Falls back to the provided fallback UI on uncaught errors.
 * Resolves to the unwrapped component until Sentry is available.
 */
export async function withSentryErrorBoundary(Component: React.ComponentType): Promise<React.ComponentType> {
    const Sentry = await ensureSentry();
    return Sentry ? Sentry.withErrorBoundary(Component, {}) : Component;
}

/**
 * HOC to wrap the app root with Sentry profiling.
 * Use in main.tsx: const App = withSentryProfiler(AppRoot);
 * Resolves to the unwrapped component until Sentry is available.
 */
export async function withSentryProfiler(Component: React.ComponentType): Promise<React.ComponentType> {
    const Sentry = await ensureSentry();
    return Sentry ? Sentry.withProfiler(Component) : Component;
}

/** Set Sentry user context after authentication. */
export function setSentryUser(uid: string, email?: string): void {
    void ensureSentry().then((Sentry) => {
        if (Sentry) Sentry.setUser({ id: uid, email });
    });
}

/** Clear Sentry user context on logout. */
export function clearSentryUser(): void {
    void ensureSentry().then((Sentry) => {
        if (Sentry) Sentry.setUser(null);
    });
}

/** Manually capture an exception with optional context. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
    void ensureSentry().then((Sentry) => {
        if (!Sentry) return;
        Sentry.withScope((scope) => {
            if (context) scope.setExtras(context);
            Sentry.captureException(error);
        });
    });
}

/** Manually capture a message at the given severity. */
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug' = 'info'): void {
    void ensureSentry().then((Sentry) => {
        if (Sentry) Sentry.captureMessage(message, level);
    });
}

/** Report Core Web Vitals metrics to Sentry. */
export function reportWebVitals(vitals: Record<string, number>): void {
    void ensureSentry().then((Sentry) => {
        if (!Sentry) return;
        Sentry.withScope((scope) => {
            scope.setLevel('info');
            Object.entries(vitals).forEach(([name, value]) => {
                scope.setTag(`vital_${name}`, value.toString());
            });
            Sentry.captureMessage('Web Vitals collected', 'info');
        });
    });
}

/** Report bundle metrics to Sentry. */
export function reportBundleMetrics(jsSize: number, cssSize: number, totalSize: number): void {
    void ensureSentry().then((Sentry) => {
        if (!Sentry) return;
        Sentry.withScope((scope) => {
            scope.setLevel('info');
            scope.setTag('bundle_js_bytes', (jsSize / 1024).toFixed(1));
            scope.setTag('bundle_css_bytes', (cssSize / 1024).toFixed(1));
            scope.setTag('bundle_total_bytes', (totalSize / 1024).toFixed(1));
            Sentry.captureMessage('Bundle metrics collected', 'info');
        });
    });
}
