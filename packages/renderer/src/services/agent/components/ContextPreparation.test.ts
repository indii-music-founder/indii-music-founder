import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextPreparation } from './ContextPreparation';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('@/core/logger/Logger', () => ({ Logger: { warn, info: vi.fn(), debug: vi.fn(), error: vi.fn() } }));

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
        const rejected = expect(pending).rejects.toMatchObject({ stage: 'artist master directive', message: 'Getting this reply ready took too long. Please send your message again.' });
        await vi.advanceTimersByTimeAsync(40);
        await rejected;
        const next = vi.fn(async () => 'must not run');
        await expect(preparation.wait('execution', next)).rejects.toMatchObject({ stage: 'artist master directive', message: 'Getting this reply ready took too long. Please send your message again.' });
        expect(next).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('logs how long each stage took when the shared budget runs out (ISSUE-1710)', async () => {
        vi.useFakeTimers();
        warn.mockClear();
        const preparation = new ContextPreparation(undefined, 100);
        await vi.advanceTimersByTimeAsync(30);
        await preparation.wait('conversation history', async () => 'history');
        await vi.advanceTimersByTimeAsync(50);
        preparation.mark('memory recall');
        const pending = preparation.wait('artist master directive', () => new Promise(() => {}));
        const rejected = expect(pending).rejects.toMatchObject({ stage: 'artist master directive', message: 'Getting this reply ready took too long. Please send your message again.' });
        await vi.advanceTimersByTimeAsync(20);
        await rejected;
        expect(warn).toHaveBeenCalledWith('ContextPreparation', 'Timed out during artist master directive', {
            'conversation history': 30,
            'memory recall': 80,
            elapsedMs: 100,
        });
    });
});
