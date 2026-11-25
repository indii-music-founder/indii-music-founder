/**
 * Shared CORS header rewriting helpers for Electron Studio renderer requests
 * to Google and Firebase backends.
 *
 * Background:
 * - Packaged Electron loads the Studio from `file://`, where Chromium's serialized
 *   origin is `'null'` (not `'file://'`). Returning `Access-Control-Allow-Origin: file://`
 *   fails Chromium's CORS origin check.
 * - WHATWG Fetch §4.9 disables wildcard (`*`) matching in `Access-Control-Allow-Headers`
 *   and `Access-Control-Expose-Headers` whenever `Access-Control-Allow-Credentials: true`
 *   is set, and `*` never covers the `Authorization` header. Explicit header allowlists
 *   are therefore mandatory for authenticated Firebase Auth / Firestore / Cloud Functions calls.
 */

const MAX_TRACKED_PREFLIGHTS = 256;
const preflightRequestHeadersById = new Map<number, string>();

export const GOOGLE_FIREBASE_ALLOWED_HEADERS: readonly string[] = [
    'authorization',
    'content-type',
    'accept',
    'origin',
    'x-requested-with',
    'x-firebase-appcheck',
    'x-firebase-client',
    'x-firebase-gmpid',
    'x-client-version',
    'x-goog-api-client',
    'x-goog-api-key',
    'x-goog-request-params',
    'x-goog-authuser',
    'x-goog-upload-protocol',
    'x-goog-upload-command',
    'x-goog-upload-header-content-length',
    'x-goog-upload-header-content-type',
    'x-goog-upload-offset',
    'x-app-client-type',
    'firebase-instance-id-token',
];

export const GOOGLE_FIREBASE_EXPOSED_HEADERS: readonly string[] = [
    'content-type',
    'content-length',
    'x-goog-upload-url',
    'x-goog-upload-status',
    'x-goog-upload-chunk-granularity',
    'x-goog-upload-size-received',
    'x-goog-upload-control-url',
    'x-firebase-request-id',
    'x-request-id',
];

/**
 * Returns true if the URL targets a Google, Firebase, Cloud Run, or local dev endpoint
 * that requires Electron CORS header normalization.
 */
export function isGoogleOrFirebaseUrl(url: string): boolean {
    if (!url) return false;
    return (
        url.includes('.googleapis.com') ||
        url.includes('.firebaseapp.com') ||
        url.includes('.cloudfunctions.net') ||
        url.includes('.run.app') ||
        url.includes('localhost') ||
        url.includes('127.0.0.1')
    );
}

/**
 * Resolves the safe `Access-Control-Allow-Origin` header value for an Electron request.
 * Valid `http://` or `https://` origins (such as the Vite dev server) are preserved;
 * `file://` or missing initiators resolve to `'null'`, matching Chromium's serialized
 * opaque origin for file URLs.
 */
export function resolveAllowedCorsOrigin(initiator?: string): string {
    if (typeof initiator !== 'string') return 'null';
    const trimmed = initiator.trim();
    if (/^https?:\/\/[^/\s]+$/i.test(trimmed)) {
        return trimmed;
    }
    return 'null';
}

/**
 * Records any `Access-Control-Request-Headers` from an outgoing preflight request
 * keyed by Electron's request ID so `onHeadersReceived` can echo requested headers.
 */
export function recordPreflightRequestHeaders(
    requestId: number | undefined,
    requestHeaders?: Record<string, string>,
): void {
    if (typeof requestId !== 'number' || !requestHeaders) return;

    let requestedHeadersValue: string | undefined;
    for (const [key, value] of Object.entries(requestHeaders)) {
        if (key.toLowerCase() === 'access-control-request-headers' && typeof value === 'string') {
            requestedHeadersValue = value.trim();
            break;
        }
    }

    if (!requestedHeadersValue) return;

    if (preflightRequestHeadersById.has(requestId)) {
        preflightRequestHeadersById.delete(requestId);
    } else if (preflightRequestHeadersById.size >= MAX_TRACKED_PREFLIGHTS) {
        const oldestKey = preflightRequestHeadersById.keys().next().value;
        if (oldestKey !== undefined) {
            preflightRequestHeadersById.delete(oldestKey);
        }
    }

    preflightRequestHeadersById.set(requestId, requestedHeadersValue);
}

/**
 * Removes any stored preflight request headers for a completed or failed request.
 */
export function clearPreflightRequestHeaders(requestId: number | undefined): void {
    if (typeof requestId !== 'number') return;
    preflightRequestHeadersById.delete(requestId);
}

function consumePreflightRequestHeaders(requestId: number | undefined): string | undefined {
    if (typeof requestId !== 'number') return undefined;
    const value = preflightRequestHeadersById.get(requestId);
    if (value !== undefined) {
        preflightRequestHeadersById.delete(requestId);
    }
    return value;
}

function collectHeaderTokens(
    target: Set<string>,
    rawValue: string | string[] | undefined,
): void {
    if (!rawValue) return;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const entry of values) {
        for (const token of entry.split(',')) {
            const normalized = token.trim().toLowerCase();
            if (normalized && normalized !== '*') {
                target.add(normalized);
            }
        }
    }
}

/**
 * Normalizes CORS response headers on Google/Firebase/Cloud Run responses in Electron
 * using explicit non-wildcard header allowlists and a valid Chromium-compatible origin.
 */
export function applyGoogleFirebaseCorsHeaders(
    details: { id?: number; url?: string; method?: string; initiator?: string },
    responseHeaders: Record<string, string | string[]>,
): { applied: boolean; allowedOrigin?: string } {
    if (!isGoogleOrFirebaseUrl(details?.url || '')) {
        return { applied: false };
    }

    const allowHeaders = new Set<string>(GOOGLE_FIREBASE_ALLOWED_HEADERS);
    const exposeHeaders = new Set<string>(GOOGLE_FIREBASE_EXPOSED_HEADERS);

    for (const key of Object.keys(responseHeaders)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'access-control-allow-headers') {
            collectHeaderTokens(allowHeaders, responseHeaders[key]);
        } else if (lowerKey === 'access-control-expose-headers') {
            collectHeaderTokens(exposeHeaders, responseHeaders[key]);
        }
        if (lowerKey.startsWith('access-control-')) {
            delete responseHeaders[key];
        }
    }

    const requestedHeaders = consumePreflightRequestHeaders(details.id);
    if (requestedHeaders) {
        collectHeaderTokens(allowHeaders, requestedHeaders);
    }

    const allowedOrigin = resolveAllowedCorsOrigin(details.initiator);
    responseHeaders['access-control-allow-origin'] = [allowedOrigin];
    responseHeaders['access-control-allow-credentials'] = ['true'];
    responseHeaders['access-control-allow-methods'] = ['GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD'];
    responseHeaders['access-control-allow-headers'] = [Array.from(allowHeaders).join(', ')];
    responseHeaders['access-control-expose-headers'] = [Array.from(exposeHeaders).join(', ')];
    responseHeaders['access-control-max-age'] = ['86400'];

    return { applied: true, allowedOrigin };
}
