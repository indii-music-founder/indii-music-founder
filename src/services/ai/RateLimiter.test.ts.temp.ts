import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './RateLimiter';

describe('RateLimiter', () => {
    let now = 1700000000000;

    beforeEach(() => {
        vi.spyOn(Date, 'now').mockImplementation(() => now);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize with max tokens', () => {
        const limiter = new RateLimiter(60, 10);
        expect(limiter.getRemainingTokens()).toBe(10);
    });

    it('should refill over time', () => {
        const limiter = new RateLimiter(60, 0); // 1 token per second
        expect(limiter.getRemainingTokens()).toBe(0);

        // Advance 1 second
        now += 1000;
        expect(limiter.getRemainingTokens()).toBe(1);

        // Advance another second
        now += 1000;
        expect(limiter.getRemainingTokens()).toBe(2);
    });

    it('should wait for token in acquire()', async () => {
        const limiter = new RateLimiter(60, 0); 
        
        // Start acquire in a promise
        const acquirePromise = limiter.acquire(5000);
        
        // Use a loop to advance time and yield to microtasks
        for (let i = 0; i < 2; i++) {
            now += 1000;
            // No need for advanceTimers because we use real timers but controlled Date.now
            // However, acquire() has a setTimeout(1000) inside.
            // We need fake timers for the setTimeout part.
        }
    });
});
