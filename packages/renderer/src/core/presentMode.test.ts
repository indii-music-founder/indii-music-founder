import { afterEach, describe, expect, it } from 'vitest';
import { __resetPresentModeForTests, installPresentModeShortcut, isPresenting } from '@/core/presentMode';

describe('present mode shortcut', () => {
    afterEach(() => __resetPresentModeForTests(false));

    it('toggles on Shift+P', () => {
        const cleanup = installPresentModeShortcut();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', shiftKey: true }));
        expect(isPresenting()).toBe(true);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', shiftKey: true }));
        expect(isPresenting()).toBe(false);
        cleanup();
    });

    it('ignores Shift+P while typing and plain P / Cmd+Shift+P', () => {
        const cleanup = installPresentModeShortcut();
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', shiftKey: true, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', shiftKey: true, metaKey: true }));
        expect(isPresenting()).toBe(false);
        input.remove();
        cleanup();
    });
});
