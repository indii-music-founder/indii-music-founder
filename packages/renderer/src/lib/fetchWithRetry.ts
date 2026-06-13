/**
 * fetchWithRetry — Drop-in replacement for native fetch() with automatic
 * AbortSignal timeout, exponential backoff retries, and HTTP status handling.
 * Prevents hanging requests from leaking resources and improves resilience against
 * transient network failures.
 */

export interface FetchWithRetryOptions extends RequestInit {
    /** Maximum number of retries before giving up. Defaults to 3. */
    maxRetries?: number;
    /** Base delay in milliseconds for exponential backoff. Defaults to 500. */
    baseDelayMs?: number;
    /** Timeout for each individual request attempt. Defaults to 30000ms. */
    timeoutMs?: number;
    /** Whether to automatically throw an Error if response.ok is false. Defaults to true. */
    throwOnHttpError?: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchWithRetry(
    input: RequestInfo | URL,
    options: FetchWithRetryOptions = {}
): Promise<Response> {
    const {
        maxRetries = 3,
        baseDelayMs = 500,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        throwOnHttpError = true,
        ...init
    } = options;

    let attempt = 0;

    while (attempt <= maxRetries) {
        let signal = init.signal;
        // If caller didn't provide a signal, create a timeout signal for this attempt
        if (!signal) {
            signal = AbortSignal.timeout(timeoutMs);
        }

        try {
            const response = await fetch(input, { ...init, signal });

            if (!response.ok) {
                const isTransientError = [408, 429, 500, 502, 503, 504].includes(response.status);
                
                if (isTransientError && attempt < maxRetries) {
                    throw new Error(`Transient HTTP Error: ${response.status} ${response.statusText}`);
                }

                if (throwOnHttpError) {
                    throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
                }
            }

            return response;
        } catch (error: any) {
            // Determine if we should retry
            const isAbortError = error.name === 'AbortError' || error.name === 'TimeoutError';
            const isTransientError = error.message.includes('Transient HTTP Error') || 
                                     error.message.includes('fetch failed') || 
                                     error.message.includes('Network request failed');

            if ((isAbortError || isTransientError) && attempt < maxRetries) {
                attempt++;
                const delay = baseDelayMs * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            throw error;
        }
    }

    throw new Error('fetchWithRetry: Max retries exceeded (should be unreachable)');
}
