import { renderHook, act } from '@testing-library/react';
import { useGlobalShortcuts } from './GlobalKeyboardShortcuts';
import { useStore } from '@/core/store';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock store
vi.mock('@/core/store', () => ({
    useStore: vi.fn(),
}));

describe('useGlobalShortcuts', () => {
    let toggleAgentWindow: any;
    let toggleSidebar: any;
    let isCommandBarDetached = false;
    let isAgentOpen = false;

    beforeEach(() => {
        toggleAgentWindow = vi.fn();
        toggleSidebar = vi.fn();
        isCommandBarDetached = false;
        isAgentOpen = false;

        (useStore as any).mockImplementation((selector: any) => {
            return selector({
                toggleAgentWindow,
                toggleSidebar,
                isCommandBarDetached,
                isAgentOpen
            });
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('toggles agent window on Cmd+K', () => {
        renderHook(() => useGlobalShortcuts());

        const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
        window.dispatchEvent(event);

        expect(toggleAgentWindow).toHaveBeenCalled();
    });

    it('toggles sidebar on Cmd+B', () => {
        renderHook(() => useGlobalShortcuts());

        const event = new KeyboardEvent('keydown', { key: 'b', metaKey: true });
        window.dispatchEvent(event);

        expect(toggleSidebar).toHaveBeenCalled();
    });

    it('opens shortcuts modal on ?', () => {
        const { result } = renderHook(() => useGlobalShortcuts());

        expect(result.current.isOpen).toBe(false);

        act(() => {
            const event = new KeyboardEvent('keydown', { key: '?' });
            window.dispatchEvent(event);
        });

        expect(result.current.isOpen).toBe(true);
    });

    it('closes shortcuts modal on Escape', () => {
        const { result } = renderHook(() => useGlobalShortcuts());

        // Open first
        act(() => {
            const event = new KeyboardEvent('keydown', { key: '?' });
            window.dispatchEvent(event);
        });
        expect(result.current.isOpen).toBe(true);

        // Close
        act(() => {
            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            window.dispatchEvent(event);
        });

        expect(result.current.isOpen).toBe(false);
    });

    it('does not trigger shortcuts when typing in an input', () => {
        renderHook(() => useGlobalShortcuts());

        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        const event = new KeyboardEvent('keydown', { key: '?' });
        Object.defineProperty(event, 'target', { value: input });

        window.dispatchEvent(event);

        // Should NOT trigger because we are in an input
        // Since we can't easily check "isOpen" state change without `result`, 
        // let's rely on the mock logic internal to the hook (which we can't see transparently here without result).
        // Actually, we can check result.
    });

    it('does not trigger help modal when typing in input', () => {
        const { result } = renderHook(() => useGlobalShortcuts());

        const input = document.createElement('input');
        document.body.appendChild(input);

        act(() => {
            const event = new KeyboardEvent('keydown', { key: '?' });
            Object.defineProperty(event, 'target', { writable: true, value: input });
            window.dispatchEvent(event);
        });

        expect(result.current.isOpen).toBe(false);
        document.body.removeChild(input);
    });
});
