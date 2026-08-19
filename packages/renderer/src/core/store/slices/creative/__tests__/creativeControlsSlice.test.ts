import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { buildCreativeControlsState } from '../creativeControlsSlice';

describe('creativeControlsSlice — view-mode navigation history (ISSUE-1375)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let useStore: any;

    beforeEach(() => {
        useStore = create((...args: [unknown, unknown]) => {
            const [set, get] = args as Parameters<typeof buildCreativeControlsState>;
            return buildCreativeControlsState(set, get);
        });
    });

    it('starts on direct with a single-entry history', () => {
        const s = useStore.getState();
        expect(s.viewMode).toBe('direct');
        expect(s._viewModeHistory).toEqual(['direct']);
        expect(s._viewModeIndex).toBe(0);
    });

    it('records switches in order and dedupes consecutive repeats', () => {
        useStore.getState().setViewMode('canvas');
        useStore.getState().setViewMode('direct');
        useStore.getState().setViewMode('direct'); // no-op (same as current)
        useStore.getState().setViewMode('canvas');

        const s = useStore.getState();
        expect(s._viewModeHistory).toEqual(['direct', 'canvas', 'direct', 'canvas']);
        expect(s._viewModeIndex).toBe(3);
        expect(s.viewMode).toBe('canvas');
    });

    it('back/forward move through visited views without creating entries', () => {
        useStore.getState().setViewMode('canvas'); // ['direct','canvas'] idx 1
        useStore.getState().setViewMode('showroom'); // idx 2

        useStore.getState().viewModeBack(); // -> canvas
        expect(useStore.getState().viewMode).toBe('canvas');
        expect(useStore.getState()._viewModeIndex).toBe(1);

        useStore.getState().viewModeBack(); // -> direct
        expect(useStore.getState().viewMode).toBe('direct');
        expect(useStore.getState()._viewModeIndex).toBe(0);

        useStore.getState().viewModeBack(); // bound — stays
        expect(useStore.getState().viewMode).toBe('direct');

        useStore.getState().viewModeForward(); // -> canvas
        expect(useStore.getState().viewMode).toBe('canvas');

        useStore.getState().viewModeForward(); // -> showroom
        useStore.getState().viewModeForward(); // bound — stays
        expect(useStore.getState().viewMode).toBe('showroom');

        // History unchanged by back/forward movement.
        expect(useStore.getState()._viewModeHistory).toEqual(['direct', 'canvas', 'showroom']);
    });

    it('a new switch after going back trims the forward entries (undo semantics)', () => {
        useStore.getState().setViewMode('canvas'); // idx 1
        useStore.getState().setViewMode('showroom'); // idx 2
        useStore.getState().viewModeBack(); // -> canvas (idx 1)

        useStore.getState().setViewMode('lab'); // trims 'showroom'

        const s = useStore.getState();
        expect(s._viewModeHistory).toEqual(['direct', 'canvas', 'lab']);
        expect(s._viewModeIndex).toBe(2);
    });

    it('caps the history at 30 entries', () => {
        const s = useStore.getState();
        for (let i = 0; i < 40; i += 1) {
            s.setViewMode(i % 2 === 0 ? 'canvas' : 'direct');
        }
        const after = useStore.getState();
        expect(after._viewModeHistory.length).toBeLessThanOrEqual(30);
        expect(after._viewModeIndex).toBe(after._viewModeHistory.length - 1);
    });
});
