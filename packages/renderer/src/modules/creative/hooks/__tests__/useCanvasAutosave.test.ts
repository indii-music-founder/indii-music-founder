// Pure scheduling replaces the former mocked store/Firebase hook journey.
// Actual UI autosave and close/reopen require the genuine-account acceptance test.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtworkWriteQueue, type ArtworkSaveStatus } from '@/services/canvas/ArtworkWriteQueue';

// Scheduling checks use plain numbers and actual callbacks, not customer/service fixtures.
describe('latest-value write scheduling', () => {
    afterEach(() => vi.useRealTimers());
    it('does not write when no value has been supplied', async () => {
        const values: number[] = [];
        const queue = new ArtworkWriteQueue<number>(async value => { values.push(value); });
        await queue.flush();
        expect(values).toEqual([]);
    });
    it('debounces updates and never repeats an acknowledged version', async () => {
        vi.useFakeTimers();
        const values: number[] = [], statuses: ArtworkSaveStatus[] = [];
        const queue = new ArtworkWriteQueue<number>(async value => { values.push(value); }, state => statuses.push(state));
        queue.update(10, 1); await vi.advanceTimersByTimeAsync(1500);
        queue.update(20, 2); await vi.advanceTimersByTimeAsync(1999);
        expect(values).toEqual([]);
        await vi.advanceTimersByTimeAsync(1);
        expect(values).toEqual([20]); expect(statuses.at(-1)).toBe('saved');
        queue.update(20, 2); await vi.advanceTimersByTimeAsync(3000);
        expect(values).toEqual([20]);
    });
    it('an explicit flush waits for changes made while a write is in flight', async () => {
        const values: number[] = [];
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const queue = new ArtworkWriteQueue<number>(async value => { values.push(value); if (value === 10) await gate; });
        queue.update(10, 1);
        const flush = queue.flush(); await Promise.resolve();
        queue.update(20, 2);
        expect(queue.flush()).toBe(flush);
        release(); await flush;
        expect(values).toEqual([10, 20]);
        queue.cancelTimer();
    });
    it('keeps the debounce for updates during automatic writes', async () => {
        vi.useFakeTimers();
        const values: number[] = [];
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const queue = new ArtworkWriteQueue<number>(async value => { values.push(value); if (value === 1) await gate; });
        queue.update(1, 1); await vi.advanceTimersByTimeAsync(2000);
        queue.update(2, 2); release(); await vi.advanceTimersByTimeAsync(1000);
        expect(values).toEqual([1]);
        await vi.advanceTimersByTimeAsync(1000);
        expect(values).toEqual([1, 2]);
    });
    it('does not lose an automatic update that becomes due during a slow write', async () => {
        vi.useFakeTimers();
        const values: number[] = [];
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const queue = new ArtworkWriteQueue<number>(async value => { values.push(value); if (value === 1) await gate; });
        queue.update(1, 1); await vi.advanceTimersByTimeAsync(2000);
        queue.update(2, 2); await vi.advanceTimersByTimeAsync(2000);
        expect(values).toEqual([1]);
        release(); await vi.advanceTimersByTimeAsync(0);
        expect(values).toEqual([1, 2]);
    });
    it('reports failures and retries the latest value without losing it', async () => {
        vi.useFakeTimers();
        let fail = true;
        const values: number[] = [], statuses: ArtworkSaveStatus[] = [];
        const queue = new ArtworkWriteQueue<number>(async value => {
            if (fail) throw new Error('Controlled arithmetic callback failure');
            values.push(value);
        }, state => statuses.push(state));
        queue.update(5, 1);
        await expect(queue.flush()).rejects.toThrow(/callback failure/);
        expect(statuses.at(-1)).toBe('error');
        fail = false; queue.update(6, 2); await queue.flush();
        expect(values).toEqual([6]); expect(statuses.at(-1)).toBe('saved');
        queue.cancelTimer();
    });
});
