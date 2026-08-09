import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalKeyboardOrchestrator } from './GlobalKeyboardOrchestrator';

describe('GlobalKeyboardOrchestrator registration cleanup', () => {
    const cleanups: Array<() => void> = [];

    afterEach(() => {
        cleanups.splice(0).forEach(cleanup => cleanup());
        globalKeyboardOrchestrator.dispose();
    });

    it('does not remove another mounted listener that shares the same semantic id', () => {
        const first = vi.fn();
        const second = vi.fn();
        const cleanupFirst = globalKeyboardOrchestrator.register({ id: 'dialog-tab', key: 'F9', handler: first });
        cleanups.push(cleanupFirst);
        cleanups.push(globalKeyboardOrchestrator.register({ id: 'dialog-tab', key: 'F9', handler: second }));

        cleanupFirst();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F9', code: 'F9' }));

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledOnce();
    });
});
