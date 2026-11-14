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

    it.each([{ isComposing: true }, { keyCode: 229 }])('leaves composition keystrokes to the input method (%j)', composition => {
        const close = vi.fn((event: KeyboardEvent) => event.preventDefault());
        cleanups.push(globalKeyboardOrchestrator.register({
            id: 'composition-escape', key: 'Escape', priority: 'modal', ignoreInput: true, handler: close,
        }));
        const composingEscape = new KeyboardEvent('keydown', {
            key: 'Escape', bubbles: true, cancelable: true, ...composition,
        });
        window.dispatchEvent(composingEscape);
        expect(close).not.toHaveBeenCalled();
        expect(composingEscape.defaultPrevented).toBe(false);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
        expect(close).toHaveBeenCalledOnce();
    });

    it('offers the newest modal Escape handler the key before an older dialog', () => {
        const older = vi.fn();
        const newer = vi.fn((event: KeyboardEvent) => event.preventDefault());
        cleanups.push(globalKeyboardOrchestrator.register({ id: 'older', key: 'Escape', priority: 'modal', ignoreInput: true, handler: older }));
        cleanups.push(globalKeyboardOrchestrator.register({ id: 'newer', key: 'Escape', priority: 'modal', ignoreInput: true, handler: newer }));

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

        expect(newer).toHaveBeenCalledOnce();
        expect(older).not.toHaveBeenCalled();
    });
});
