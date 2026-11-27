import { describe, it, expect, vi } from 'vitest';
import { canReplaceOnBoardroomTimeout, runSeatWithTimeout } from '@/services/agent/boardroomRunTimeout';

describe('canReplaceOnBoardroomTimeout (ISSUE-1656)', () => {
    it('never replaces a seat reply that already has real text', () => {
        expect(canReplaceOnBoardroomTimeout({ text: 'Here is the release plan: ...' })).toBe(false);
    });

    it('replaces placeholders and empty replies', () => {
        expect(canReplaceOnBoardroomTimeout({ text: '' })).toBe(true);
        expect(canReplaceOnBoardroomTimeout({ text: '*(Reviewing request...)*' })).toBe(true);
        expect(canReplaceOnBoardroomTimeout(undefined)).toBe(true);
    });
});

describe('runSeatWithTimeout (ISSUE-1665)', () => {
    it('aborts the seat work on timeout and reports it no longer live', async () => {
        vi.useFakeTimers();
        try {
            let seatSignal: AbortSignal | undefined;
            let isLive: (() => boolean) | undefined;
            const pending = runSeatWithTimeout(({ signal, isLive: live }) => {
                seatSignal = signal;
                isLive = live;
                return new Promise<string>(() => {});
            }, { timeoutMs: 1_000 });
            const assertion = expect(pending).rejects.toThrow('Agent execution timed out (1s)');
            await vi.advanceTimersByTimeAsync(1_001);
            await assertion;
            expect(seatSignal?.aborted).toBe(true);
            expect(isLive?.()).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it('clears its timer when the seat finishes first', async () => {
        vi.useFakeTimers();
        try {
            const result = runSeatWithTimeout(async () => 'answer', { timeoutMs: 1_000 });
            await expect(result).resolves.toBe('answer');
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it('propagates the user Stop into the seat signal', async () => {
        const stop = new AbortController();
        let seatSignal: AbortSignal | undefined;
        const pending = runSeatWithTimeout(({ signal }) => {
            seatSignal = signal;
            return new Promise<string>((_, reject) => signal.addEventListener('abort', () => reject(new Error('stopped'))));
        }, { parentSignal: stop.signal });
        stop.abort('User requested stop');
        await expect(pending).rejects.toThrow('stopped');
        expect(seatSignal?.aborted).toBe(true);
    });
});
