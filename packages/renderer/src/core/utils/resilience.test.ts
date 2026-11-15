import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff, withTimeout, CircuitBreaker, CancellationToken } from './resilience';

describe('resilience primitives', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('retryWithBackoff', () => {
        it('rejects invalid maxAttempts < 1 instead of throwing undefined', async () => {
            await expect(
                retryWithBackoff(async () => 'ok', { maxAttempts: 0 })
            ).rejects.toThrow(/maxAttempts must be at least 1/i);
        });

        it('retries errors matched by error.code as well as message', async () => {
            const errWithCode = Object.assign(new Error('socket hung up'), { code: 'ECONNRESET' });
            const fn = vi
                .fn<() => Promise<string>>()
                .mockRejectedValueOnce(errWithCode)
                .mockResolvedValueOnce('recovered');

            const promise = retryWithBackoff(fn, { initialDelayMs: 50, maxAttempts: 3 });
            await vi.advanceTimersByTimeAsync(50);

            await expect(promise).resolves.toBe('recovered');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('does not retry non-retryable errors', async () => {
            const fn = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('Validation failed'));
            await expect(retryWithBackoff(fn, { maxAttempts: 3 })).rejects.toThrow('Validation failed');
            expect(fn).toHaveBeenCalledTimes(1);
        });
    });

    describe('withTimeout', () => {
        it('rejects with timeout message when inner promise exceeds deadline', async () => {
            const never = new Promise<string>(() => {});
            const wrapped = withTimeout(never, 100, 'Timed out waiting');

            const assertion = expect(wrapped).rejects.toThrow('Timed out waiting');
            await vi.advanceTimersByTimeAsync(100);
            await assertion;
        });

        it('settles and rejects cleanly when abort() is called', async () => {
            const never = new Promise<string>(() => {});
            const wrapped = withTimeout(never, 5000);

            const assertion = expect(wrapped).rejects.toThrow('Operation aborted');
            wrapped.abort();
            await assertion;
        });
    });

    describe('CircuitBreaker', () => {
        it('re-opens immediately on any failure in half-open state', async () => {
            const breaker = new CircuitBreaker(2, 1000, 2);
            const fail = () => Promise.reject(new Error('downstream error'));

            await expect(breaker.execute(fail)).rejects.toThrow('downstream error');
            await expect(breaker.execute(fail)).rejects.toThrow('downstream error');
            expect(breaker.getState()).toBe('open');

            await vi.advanceTimersByTimeAsync(1000);

            // First half-open call succeeds, resetting failureCount to 0, state remains half-open
            await expect(breaker.execute(async () => 'ok')).resolves.toBe('ok');
            expect(breaker.getState()).toBe('half-open');

            // Second half-open call fails -> must immediately trip back to open
            await expect(breaker.execute(fail)).rejects.toThrow('downstream error');
            expect(breaker.getState()).toBe('open');
        });
    });

    describe('CancellationToken', () => {
        it('isolates throwing abort callbacks, clears listeners, and supports unsubscribe', () => {
            const token = new CancellationToken();
            const unsubRemoved = token.onAbort(() => {
                throw new Error('should not run');
            });
            unsubRemoved();

            const first = vi.fn(() => {
                throw new Error('listener error');
            });
            const second = vi.fn();
            token.onAbort(first);
            token.onAbort(second);

            expect(() => token.abort()).not.toThrow();
            expect(first).toHaveBeenCalledTimes(1);
            expect(second).toHaveBeenCalledTimes(1);
            expect(token.isAborted()).toBe(true);
            expect(() => token.throwIfAborted()).toThrow('Operation was cancelled');
        });
    });
});
