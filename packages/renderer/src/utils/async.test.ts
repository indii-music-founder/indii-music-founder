import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { delay, retry } from './async';

describe('async utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('delay', () => {
    it('should resolve after the specified time', async () => {
      let resolved = false;
      const waitTime = 100;
      
      const promise = delay(waitTime).then(() => {
        resolved = true;
      });

      // Should not be resolved initially
      expect(resolved).toBe(false);

      // Advance timers just before it should resolve
      await vi.advanceTimersByTimeAsync(waitTime - 1);
      expect(resolved).toBe(false);

      // Advance to the exact time
      await vi.advanceTimersByTimeAsync(1);
      await promise;
      expect(resolved).toBe(true);
    });
  });

  describe('retry', () => {
    it('should return the result if the function succeeds on the first try', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const promise = retry(fn, 3, 10);
      
      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry and eventually succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const promise = retry(fn, 3, 10);

      // Advance timers for the delays
      // First wait is 10ms, second is 20ms
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(20);
      
      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw an error if all retries fail', async () => {
      const error = new Error('permanent fail');
      const fn = vi.fn().mockRejectedValue(error);
      
      // We don't want the unhandled rejection warning, so we catch it immediately
      const promise = retry(fn, 2, 10);
      const catchMock = vi.fn();
      promise.catch(catchMock);

      // Wait a tick to process initial rejection
      await vi.advanceTimersByTimeAsync(0);

      // Advance timers to trigger retries
      await vi.advanceTimersByTimeAsync(10); // 1st retry (10ms wait)
      await vi.advanceTimersByTimeAsync(0); // process 1st retry

      await vi.advanceTimersByTimeAsync(20); // 2nd retry (20ms wait)

      await expect(promise).rejects.toThrow('permanent fail');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(catchMock).toHaveBeenCalledWith(error);
    });

    it('should use exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const promise = retry(fn, 2, 50);

      // Initial try failed. It's waiting 50ms for first retry.
      await vi.advanceTimersByTimeAsync(0); // process initial failure
      await vi.advanceTimersByTimeAsync(49);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1); // 50ms total
      await vi.advanceTimersByTimeAsync(0); // process promise chain
      expect(fn).toHaveBeenCalledTimes(2);

      // Second try failed. It's waiting 100ms for second retry.
      await vi.advanceTimersByTimeAsync(99);
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1); // 100ms total
      await vi.advanceTimersByTimeAsync(0); // process promise chain
      expect(fn).toHaveBeenCalledTimes(3);
      
      const result = await promise;
      expect(result).toBe('success');
    });
  });
});
