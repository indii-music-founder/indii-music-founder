import { HttpsError } from 'firebase-functions/v2/https';

const PRIVATE_OR_RESERVED_HOST_PATTERNS: RegExp[] = [
    /^localhost$/i,
    /\.local$/i,
    /\.internal$/i,
    /^metadata\.google\.internal$/i,
    /^127\.(?:\d{1,3}\.){2}\d{1,3}$/,
    /^10\.(?:\d{1,3}\.){2}\d{1,3}$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
    /^169\.254\.\d{1,3}\.\d{1,3}$/,
    /^0\.(?:\d{1,3}\.){2}\d{1,3}$/,
    /^\[?(?:::1|0:0:0:0:0:0:0:1|fe80:|fc00:|fd00:|::ffff:(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.|169\.254\.))/i,
];

/**
 * Validates that a URL is an HTTPS URL pointing at a public, non-private host.
 * Rejects `http:`, loopback (`localhost`, `127.0.0.0/8`, `::1`), RFC 1918 private
 * networks (`10/8`, `172.16/12`, `192.168/16`), link-local metadata endpoints
 * (`169.254.169.254`, `metadata.google.internal`), and embedded credentials.
 */
export function isSafeExternalHttpsUrl(rawUrl: unknown): boolean {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
        return false;
    }
    let parsed: URL;
    try {
        parsed = new URL(rawUrl.trim());
    } catch {
        return false;
    }
    if (parsed.protocol !== 'https:') {
        return false;
    }
    if (parsed.username || parsed.password) {
        return false;
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (!hostname || !hostname.includes('.')) {
        return false;
    }
    if (PRIVATE_OR_RESERVED_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
        return false;
    }
    return true;
}

/**
 * Throws `HttpsError('invalid-argument', ...)` if `rawUrl` is not a safe external HTTPS URL.
 */
export function assertSafeExternalHttpsUrl(rawUrl: unknown, fieldName = 'url'): string {
    if (!isSafeExternalHttpsUrl(rawUrl)) {
        throw new HttpsError(
            'invalid-argument',
            `${fieldName} must be a valid external HTTPS URL and may not target private, loopback, or metadata hosts.`,
        );
    }
    return (rawUrl as string).trim();
}

const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Validates that an identifier is a single safe URL path segment (alphanumeric, `_`, `-`)
 * with no slashes, dots, or URL-encoded traversal sequences.
 */
export function assertSafeApiPathSegment(value: unknown, fieldName = 'id'): string {
    if (typeof value !== 'string' && typeof value !== 'number') {
        throw new HttpsError('invalid-argument', `Missing or invalid '${fieldName}'.`);
    }
    const normalized = String(value).trim();
    if (!PATH_SEGMENT_PATTERN.test(normalized)) {
        throw new HttpsError(
            'invalid-argument',
            `Invalid '${fieldName}': must contain only alphanumeric characters, hyphens, or underscores.`,
        );
    }
    return normalized;
}
