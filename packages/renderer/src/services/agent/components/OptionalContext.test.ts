import { afterEach, describe, expect, it, vi } from 'vitest';
import { readOptionalContext } from './OptionalContext';

describe('optional context budget', () => {
    afterEach(() => vi.useRealTimers());

    it('returns available context and releases its timer', async () => {
        vi.useFakeTimers();
        await expect(readOptionalContext('enrichment', async () => 'ready', 100))
            .resolves.toEqual({ value: 'ready' });
        expect(vi.getTimerCount()).toBe(0);
    });

    it('settles a stuck read and cancels its continuation without admitting late context', async () => {
        vi.useFakeTimers();
        let child!: AbortSignal;
        let resolve!: (text: string) => void;
        const pending = readOptionalContext('older conversation summary', signal => {
            child = signal;
            return new Promise<string>(r => { resolve = r; });
        }, 100);
        await vi.advanceTimersByTimeAsync(100);
        const result = await pending;
        expect(result.unavailable).toContain('older conversation summary');
        expect(result.value).toBeUndefined();
        expect(child.aborted).toBe(true);
        resolve('late result');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('reports a failed read without leaving a timer behind', async () => {
        vi.useFakeTimers();
        const result = await readOptionalContext('enrichment', async () => {
            throw new Error('unavailable');
        }, 100);
        expect(result).toEqual({ unavailable: 'unavailable' });
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does not start a read after cancellation', async () => {
        const parent = new AbortController();
        parent.abort('Stopped');
        let started = false;
        await expect(readOptionalContext('enrichment', async () => {
            started = true;
            return 'must not run';
        }, 100, parent.signal)).rejects.toBe('Stopped');
        expect(started).toBe(false);
    });

    it('propagates Stop instead of treating it as optional failure', async () => {
        const parent = new AbortController();
        const pending = readOptionalContext('enrichment', () => new Promise(() => {}), 100, parent.signal);
        const rejected = expect(pending).rejects.toBe('Stopped');
        parent.abort('Stopped');
        await rejected;
    });
});
