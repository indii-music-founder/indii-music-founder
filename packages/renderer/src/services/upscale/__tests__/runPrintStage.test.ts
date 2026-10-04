import { describe, expect, it } from 'vitest';
import { runPrintStage } from '../runPrintStage';

// Genuine promises, timers and abort signals exercise local lifecycle logic.
// No image/GPU/service/auth fixture; these checks do not certify a print master.
describe('print stage lifecycle', () => {
    it('returns a completed operation', async () => {
        await expect(runPrintStage('Local calculation', 1000, async () => 42)).resolves.toBe(42);
    });

    it('preserves an operation failure', async () => {
        const failure = new Error('Calculation failed');
        await expect(runPrintStage('Local calculation', 1000, async () => { throw failure; })).rejects.toBe(failure);
    });

    it('does not start an already cancelled operation', () => {
        const controller = new AbortController();
        controller.abort();
        let started = false;
        expect(() => runPrintStage('Local calculation', 1000, async () => { started = true; }, controller.signal)).toThrow();
        expect(started).toBe(false);
    });

    it('cancels an active operation and aborts its child signal', async () => {
        const controller = new AbortController();
        let started!: () => void;
        const running = new Promise<void>(resolve => { started = resolve; });
        let childSignal: AbortSignal | undefined;
        const stage = runPrintStage('Local calculation', 1000, async signal => {
            childSignal = signal;
            started();
            await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
        }, controller.signal);
        const rejected = expect(stage).rejects.toMatchObject({ name: 'AbortError' });
        await running;
        controller.abort();
        await rejected;
        expect(childSignal?.aborted).toBe(true);
    });

    it('expires a stalled stage and releases a late result instead of returning success', async () => {
        let finish!: (value: number) => void;
        const operation = new Promise<number>(resolve => { finish = resolve; });
        let released!: (value: number) => void;
        const lateRelease = new Promise<number>(resolve => { released = resolve; });
        let childSignal: AbortSignal | undefined;
        const stage = runPrintStage('Local calculation', 10, async signal => {
            childSignal = signal;
            return operation;
        }, undefined, released);
        await expect(stage).rejects.toThrow('Local calculation did not finish in time');
        expect(childSignal?.aborted).toBe(true);
        finish(42);
        await expect(lateRelease).resolves.toBe(42);
    });
});
