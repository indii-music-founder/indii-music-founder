/**
 * Standard asynchronous utilities for the indii.music ecosystem.
 */

/**
 * Returns a promise that resolves after a specified number of milliseconds.
 * Use this to replace raw setTimeout calls in async workflows.
 */
export const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retries an async function with exponential backoff.
 */
export const retry = async <T>(
    fn: () => Promise<T>,
    retries: number = 3,
    interval: number = 1000
): Promise<T> => {
    try {
        return await fn();
    } catch (error: unknown) {
        if (retries <= 0) throw error;
        await delay(interval);
        return retry(fn, retries - 1, interval * 2);
    }
};

/**
 * Wraps fetch with exponential backoff retry logic, specifically handling 429 (Too Many Requests)
 * and 5xx (Server Errors).
 */
export const fetchWithRetry = async (
    input: RequestInfo | URL,
    init?: RequestInit,
    retries: number = 3,
    baseInterval: number = 1000
): Promise<Response> => {
    let attempt = 0;
    while (true) {
        try {
            const response = await fetch(input, init);
            
            // Don't retry on success or typical client errors (400, 401, 403, 404)
            if (response.ok || (response.status < 500 && response.status !== 429 && response.status !== 408)) {
                return response;
            }
            
            if (attempt >= retries) {
                return response;
            }

            // Parse Retry-After header if present
            let waitTime = baseInterval * Math.pow(2, attempt);
            if (response.status === 429 || response.status === 503) {
                const retryAfter = response.headers.get('Retry-After');
                if (retryAfter) {
                    const parsed = parseInt(retryAfter, 10);
                    if (!isNaN(parsed)) {
                        waitTime = parsed * 1000;
                    }
                }
            }
            
            await delay(waitTime);
            attempt++;
        } catch (error) {
            // Network error (e.g. DNS failure, connection refused)
            if (attempt >= retries) {
                throw error;
            }
            const waitTime = baseInterval * Math.pow(2, attempt);
            await delay(waitTime);
            attempt++;
        }
    }
};
