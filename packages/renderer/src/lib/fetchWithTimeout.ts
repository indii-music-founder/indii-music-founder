/**
 * fetchWithTimeout — Drop-in replacement for native fetch() with automatic
 * AbortSignal timeout. Prevents hanging requests from leaking resources.
 *
 * Usage:
 *   import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
 *   const res = await fetchWithTimeout(url, { headers: { ... } });
 *   // or with custom timeout:
 *   const res = await fetchWithTimeout(url, { headers: { ... } }, 60_000);
 */

/** Default timeout in milliseconds (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Wrapper around the native `fetch` that attaches an `AbortSignal.timeout()`
 * when the caller has not already supplied its own signal.
 *
 * @param input   - The resource URL or Request object.
 * @param init    - Optional RequestInit (headers, method, body, etc.).
 * @param timeoutMs - Timeout in milliseconds. Defaults to 30 000 ms.
 * @returns The fetch Response.
 * @throws {DOMException} name === 'TimeoutError' when the deadline expires.
 */
export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init?: RequestInit,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
    // If the caller already attached a signal, respect it — don't override.
    if (init?.signal) {
        return fetch(input, init);
    }

    const signal = AbortSignal.timeout(timeoutMs);

    return fetch(input, { ...init, signal });
}
