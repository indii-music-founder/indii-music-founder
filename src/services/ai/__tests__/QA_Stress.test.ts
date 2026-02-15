import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../utils/CircuitBreaker';
import { RateLimiter } from '../RateLimiter';

describe('QA Stress Tests: Reliability & Stability', () => {

    describe('RateLimiter Stress Test', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should throttle bursts of requests correctly', async () => {
            // Configure: 60 requests per minute (1 per second), burst of 1
            const limiter = new RateLimiter(60, 1);

            const start = Date.now();
            const acquisitions: number[] = [];

            // Fire 5 requests immediately
            const p1 = limiter.acquire().then(() => acquisitions.push(Date.now()));
            const p2 = limiter.acquire().then(() => acquisitions.push(Date.now()));
            const p3 = limiter.acquire().then(() => acquisitions.push(Date.now()));

            // First should happen immediately (burst)
            await vi.advanceTimersByTimeAsync(1); // minimal tick
            expect(acquisitions.length).toBe(1);

            // Second should wait ~1000ms
            await vi.advanceTimersByTimeAsync(1000);
            expect(acquisitions.length).toBe(2);

            // Third should wait another ~1000ms
            await vi.advanceTimersByTimeAsync(1000);
            expect(acquisitions.length).toBe(3);
        });

        it('should timeout if rate limit prevents acquisition for too long', async () => {
            // Very slow limiter: 1 request per minute
            const limiter = new RateLimiter(1, 1);

            // Acquire the burst token
            await limiter.acquire();

            // Try to acquire next one with short timeout (e.g. 100ms)
            // Try to acquire next one with short timeout (e.g. 100ms)
            // It should fail because next token is 60s away.
            // We must start the promise and attach the handler BEFORE advancing timers to avoid "Unhandled Rejection"
            const acquirePromise = limiter.acquire(100);
            const expectation = expect(acquirePromise).rejects.toThrow('Rate limit acquisition timed out');

            // Advance time past the timeout AND past the internal sleep logic (1000ms)
            // We need to wake up the loop.
            await vi.advanceTimersByTimeAsync(2000);

            await expectation;
        });
    });

    describe('CircuitBreaker Recovery Under Load', () => {
        let breaker: CircuitBreaker;
        const failureThreshold = 3;
        const resetTimeoutMs = 5000;

        beforeEach(() => {
            vi.useFakeTimers();
            breaker = new CircuitBreaker({
                failureThreshold,
                resetTimeoutMs
            });
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should open circuit after threshold failures and block immediately', async () => {
            const failingAction = vi.fn().mockRejectedValue(new Error('Service Down'));

            // 1. Fail up to threshold
            for (let i = 0; i < failureThreshold; i++) {
                await expect(breaker.execute(failingAction)).rejects.toThrow('Service Down');
            }

            // 2. Next failure should be immediate (Circuit Open) and NOT call the action
            const start = Date.now();
            await expect(breaker.execute(failingAction)).rejects.toThrow(/Circuit.OPEN/);

            // Verify action wasn't called again
            expect(failingAction).toHaveBeenCalledTimes(failureThreshold);
        });

        it('should attempt recovery (HALF_OPEN) after timeout', async () => {
            const action = vi.fn()
                .mockRejectedValueOnce(new Error('Fail 1'))
                .mockRejectedValueOnce(new Error('Fail 2'))
                .mockRejectedValueOnce(new Error('Fail 3')) // Opens here
                .mockResolvedValue('Success'); // Next one succeeds if called

            // Trip the breaker
            for (let i = 0; i < failureThreshold; i++) {
                try { await breaker.execute(action); } catch { /* expected */ }
            }
            expect(breaker.getState()).toBe(CircuitState.OPEN);

            // Advance time past reset timeout
            vi.setSystemTime(Date.now() + resetTimeoutMs + 100);

            // Next call should execute (HALF_OPEN probe)
            const result = await breaker.execute(action);
            expect(result).toBe('Success');
            expect(breaker.getState()).toBe(CircuitState.CLOSED);
        });

        it('should re-open circuit if probe fails in HALF_OPEN state', async () => {
            const action = vi.fn().mockRejectedValue(new Error('Persistent Failure'));

            // Trip the breaker
            for (let i = 0; i < failureThreshold; i++) {
                try { await breaker.execute(action); } catch { /* expected */ }
            }

            // Advance time
            vi.setSystemTime(Date.now() + resetTimeoutMs + 100);

            // Probe fails
            await expect(breaker.execute(action)).rejects.toThrow('Persistent Failure');

            // Should be OPEN again
            expect(breaker.getState()).toBe(CircuitState.OPEN);
        });
    });
});
