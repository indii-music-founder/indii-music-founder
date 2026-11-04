import { afterEach, describe, expect, it, vi } from 'vitest';
import { runWithAgentDeadline } from '../AgentRunDeadline';

describe('runWithAgentDeadline', () => {
    afterEach(() => vi.useRealTimers());

    it('propagates parent cancellation and settles even if the executor ignores abort', async () => {
        const parent = new AbortController();
        let childSignal: AbortSignal | undefined;
        const execute = vi.fn((signal: AbortSignal) => {
            childSignal = signal;
            return new Promise<string>(() => {});
        });
        const run = runWithAgentDeadline(execute, parent.signal, 300_000, vi.fn());

        parent.abort(new Error('Artist stopped the run'));
        await expect(run).rejects.toThrow('Artist stopped the run');
        expect(childSignal?.aborted).toBe(true);
    });

    it('rejects before dispatch when the parent is already cancelled', async () => {
        const parent = new AbortController();
        parent.abort(new Error('Artist stopped the run'));
        const execute = vi.fn(async () => 'unused');

        await expect(runWithAgentDeadline(execute, parent.signal, 300_000, vi.fn()))
            .rejects.toThrow('Artist stopped the run');
        expect(execute).not.toHaveBeenCalled();
    });

    it('settles at the deadline and clears the timer after a normal result', async () => {
        vi.useFakeTimers();
        const onTimeout = vi.fn();
        const controller = new AbortController();
        const timed = runWithAgentDeadline(() => new Promise<string>(() => {}), undefined, 1000, onTimeout);
        const timedResult = expect(timed).rejects.toThrow('timed out after 1s');
        const completed = runWithAgentDeadline(async () => 'done', controller.signal, 1000, onTimeout);

        await expect(completed).resolves.toBe('done');
        await vi.advanceTimersByTimeAsync(1000);
        await timedResult;
        expect(onTimeout).toHaveBeenCalledTimes(1);
        controller.abort(new Error('late abort'));
    });
});
