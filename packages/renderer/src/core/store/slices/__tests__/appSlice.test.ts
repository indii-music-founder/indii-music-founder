import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create } from 'zustand';
import { createAppSlice, AppSlice } from '../appSlice';

describe('appSlice', () => {
    let useStore: any;

    beforeEach(() => {
        vi.useFakeTimers();
        useStore = create<AppSlice>((...args) => ({
            ...createAppSlice(...args),
        }));
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });


    describe('toggleSidebar', () => {
        it('should toggle sidebar state', () => {
            const store = useStore.getState();
            expect(store.isSidebarOpen).toBe(true); // Default is true usually, or from localStorage

            useStore.getState().toggleSidebar();

            expect(useStore.getState().isSidebarOpen).toBe(!store.isSidebarOpen);
            expect(useStore.getState()._lastSidebarToggle).toBeDefined();
        });

        it('should debounce rapid toggles', () => {
            const initialState = useStore.getState().isSidebarOpen;

            // First toggle
            useStore.getState().toggleSidebar();
            expect(useStore.getState().isSidebarOpen).toBe(!initialState);

            // Advance time slightly (under 200ms)
            vi.advanceTimersByTime(100);

            // Second toggle (should be ignored)
            useStore.getState().toggleSidebar();
            expect(useStore.getState().isSidebarOpen).toBe(!initialState); // Still flipped state

            // Advance time past debounce window
            vi.advanceTimersByTime(150); // Total 250ms

            // Third toggle (should work)
            useStore.getState().toggleSidebar();
            expect(useStore.getState().isSidebarOpen).toBe(initialState);
        });
    });

    describe('toggleRightPanel', () => {
        it('should toggle right panel state', () => {
            const store = useStore.getState();
            expect(store.isRightPanelOpen).toBe(false);

            useStore.getState().toggleRightPanel();

            expect(useStore.getState().isRightPanelOpen).toBe(true);
            expect(useStore.getState()._lastRightPanelToggle).toBeDefined();
        });

        it('should debounce rapid toggles', () => {
            // First toggle
            useStore.getState().toggleRightPanel();
            expect(useStore.getState().isRightPanelOpen).toBe(true);

            // Advance time slightly (under 200ms)
            vi.advanceTimersByTime(100);

            // Second toggle (should be ignored)
            useStore.getState().toggleRightPanel();
            expect(useStore.getState().isRightPanelOpen).toBe(true); // Still true

            // Advance time past debounce window
            vi.advanceTimersByTime(150); // Total 250ms

            // Third toggle (should work)
            useStore.getState().toggleRightPanel();
            expect(useStore.getState().isRightPanelOpen).toBe(false);
        });
    });
});
