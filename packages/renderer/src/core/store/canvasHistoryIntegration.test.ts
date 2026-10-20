import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/core/store');
vi.mock('@/hooks/useBoardroomContextHandshake', () => ({
    publishBoardroomContextUpdate: vi.fn(),
}));

import { useStore } from '@/core/store';

describe('cover history in the application store', () => {
    let previousState: ReturnType<typeof useStore.getState>;

    beforeEach(() => { previousState = useStore.getState(); });
    afterEach(() => { useStore.setState(previousState, true); });

    it('undoes and redoes edits through the persisted root store used by the live editor', () => {
        const state = useStore.getState();
        state.openImage('portrait.png', 'cover-qa');
        const original = useStore.getState().currentDoc!;
        useStore.getState().updateArtwork({ background: '#ffffff' });
        const layerId = original.layers[0]!.id;
        useStore.getState().updateLayer(layerId, { x: 120 });

        expect(useStore.getState().canvasPast).toHaveLength(2);
        useStore.getState().undoArtwork();
        expect(useStore.getState().currentDoc).toMatchObject({ background: '#ffffff', layers: [{ x: 0 }] });
        expect(useStore.getState().canvasFuture).toHaveLength(1);
        useStore.getState().undoArtwork();
        expect(useStore.getState().currentDoc).toMatchObject({ background: original.background, layers: [{ x: 0 }] });
        useStore.getState().redoArtwork();
        expect(useStore.getState().currentDoc?.background).toBe('#ffffff');
    });
});
