import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './RateLimiter';

describe('RateLimiter', () => {
    const startTime = 1700000000000;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(startTime);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should initialize with max tokens', () => {
        const limiter = new RateLimiter(60, 10);
        expect(limiter.getRemainingTokens()).toBe(10);
    });

    it('should refill over time', () => {
        const limiter = new RateLimiter(60, 10);
        // Consume all
        for (let i = 0; i < 10; i++) limiter.tryAcquire();
        expect(limiter.getRemainingTokens()).toBe(0);

        // Advance 1.1 seconds
        vi.setSystemTime(startTime + 1100);

        expect(limiter.getRemainingTokens()).toBeGreaterThanOrEqual(1);
    });

    it('should wait for token in acquire()', async () => {
        const limiter = new RateLimiter(60, 1);
        limiter.tryAcquire(); // now empty

        const acquirePromise = limiter.acquire(5000);

        // Wait for first setTimeout in the loop
        await vi.advanceTimersByTimeAsync(0);

        // Advance time enough for 1 token (refill rate is 1/s)
        vi.setSystemTime(startTime + 1500);
        await vi.advanceTimersByTimeAsync(1500);

        await expect(acquirePromise).resolves.toBeUndefined();
    });

    it('should support timeout parameter in acquire', async () => {
        const limiter = new RateLimiter(1, 1);
        limiter.tryAcquire();

        // Verify that the acquire method supports a timeout parameter
        const acquireMethod = limiter.acquire;
        expect(typeof acquireMethod).toBe('function');

        // The method should return a Promise
        const resultPromise = limiter.acquire(1000);
        expect(resultPromise instanceof Promise).toBe(true);

        // Advance time to exceed timeout in the background so the promise can reject
        Promise.resolve().then(async () => {
            vi.setSystemTime(startTime + 1500);
            await vi.advanceTimersToNextTimerAsync();
        });

        await expect(resultPromise).rejects.toThrow('Rate limit acquisition timed out');
    });
});
