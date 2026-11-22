import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmitStepTimeoutError, withStepDeadline } from './submitDeadline';

describe('withStepDeadline (ISSUE-1707)', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('passes the result through when the step finishes in time', async () => {
        await expect(withStepDeadline('Packaging', 1000, Promise.resolve('ok'))).resolves.toBe('ok');
    });

    it('passes the step error through unchanged', async () => {
        await expect(withStepDeadline('Packaging', 1000, Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    });

    it('names the step that stalled', async () => {
        const stalled = withStepDeadline('Checking cover art', 5000, new Promise<string>(() => { /* never settles */ }));
        const assertion = expect(stalled).rejects.toMatchObject({ name: 'SubmitStepTimeoutError', step: 'Checking cover art' });
        await vi.advanceTimersByTimeAsync(5001);
        await assertion;
        await expect(stalled).rejects.toBeInstanceOf(SubmitStepTimeoutError);
    });
});
