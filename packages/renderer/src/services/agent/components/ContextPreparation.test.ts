import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextPreparation } from './ContextPreparation';

describe('ContextPreparation', () => {
    afterEach(() => vi.useRealTimers());

    it('fences later reads after Stop even when the pending read resolves late', async () => {
        const controller = new AbortController();
        const preparation = new ContextPreparation(controller.signal);
        let resolve!: (value: string) => void;
        const pending = preparation.wait('history', () => new Promise<string>(r => { resolve = r; }));
        const rejected = expect(pending).rejects.toBe('Stopped');
        controller.abort('Stopped');
        await rejected;
        resolve('late context');
        const next = vi.fn(async () => 'must not run');
        await expect(preparation.wait('directive', next)).rejects.toBe('Stopped');
        expect(next).not.toHaveBeenCalled();
    });

    it('shares a deadline across stages and identifies the stalled stage', async () => {
        vi.useFakeTimers();
        const preparation = new ContextPreparation(undefined, 100);
        await expect(preparation.wait('history', async () => 'history')).resolves.toBe('history');
        await vi.advanceTimersByTimeAsync(60);
        const pending = preparation.wait('artist master directive', () => new Promise(() => {}));
        const rejected = expect(pending).rejects.toThrow('artist master directive');
        await vi.advanceTimersByTimeAsync(40);
        await rejected;
        const next = vi.fn(async () => 'must not run');
        await expect(preparation.wait('execution', next)).rejects.toThrow('artist master directive');
        expect(next).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});
