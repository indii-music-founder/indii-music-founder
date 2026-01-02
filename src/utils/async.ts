/**
 * Standard asynchronous utilities for the indiiOS ecosystem.
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
    } catch (error) {
        if (retries <= 0) throw error;
        await delay(interval);
        return retry(fn, retries - 1, interval * 2);
    }
};
