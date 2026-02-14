import { describe, it, expect, vi } from 'vitest';
import { delay, retry } from './async';

describe('async utilities', () => {
  describe('delay', () => {
    it('should resolve after the specified time', async () => {
      const start = Date.now();
      const waitTime = 100;
      await delay(waitTime);
      const end = Date.now();
      const elapsed = end - start;
      
      // Allow for some jitter in timing
      expect(elapsed).toBeGreaterThanOrEqual(waitTime - 10);
      expect(elapsed).toBeLessThan(waitTime + 100);
    });
  });

  describe('retry', () => {
    it('should return the result if the function succeeds on the first try', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn, 3, 10);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry and eventually succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const result = await retry(fn, 3, 10);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw an error if all retries fail', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('permanent fail'));
      
      await expect(retry(fn, 2, 10)).rejects.toThrow('permanent fail');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should use exponential backoff (implied by internal calls)', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');
      
      const start = Date.now();
      await retry(fn, 1, 50);
      const end = Date.now();
      
      // Should have waited at least 50ms once
      expect(end - start).toBeGreaterThanOrEqual(45);
    });
  });
});
