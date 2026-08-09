const MAX_EXTERNAL_URL_LENGTH = 2_048;

/** Return a canonical HTTP(S) URL, rejecting executable and local schemes. */
export function normalizeExternalHttpUrl(value: unknown, baseUrl?: string): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_EXTERNAL_URL_LENGTH) return null;
    try {
        const parsed = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:'
            ? parsed.toString()
            : null;
    } catch {
        return null;
    }
}
