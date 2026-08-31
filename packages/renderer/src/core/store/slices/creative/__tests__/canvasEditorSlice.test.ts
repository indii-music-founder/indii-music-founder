import { describe, it, expect, beforeEach } from 'vitest';
import { createCanvasEditorSlice } from '../canvasEditorSlice';
import type { RasterLayer } from '@/services/canvas/CanvasDoc';

// Simpler approach: exercise the slice with a tiny zustand store.
import { createStore } from 'zustand/vanilla';

function buildStore() {
    const store = createStore<ReturnType<typeof createCanvasEditorSlice>>(createCanvasEditorSlice);
    return store;
}

describe('canvasEditorSlice (C1.1)', () => {
    let store: ReturnType<typeof buildStore>;
    beforeEach(() => { store = buildStore(); });

    it('openImage creates a single-layer doc and selects it', () => {
        store.getState().openImage('data:image/png;base64,AAA', 'proj_1');
        const doc = store.getState().currentDoc!;
        expect(doc.layers).toHaveLength(1);
        expect(store.getState().selectedLayerId).toBe(doc.layers[0]!.id);
    });

    it('openDoc + addRasterLayer appends a neutral layer and selects it', () => {
        store.getState().openImage('a.png', 'p');
        const before = store.getState().currentDoc!.layers.length;
        const id = store.getState().addRasterLayer('b.png', 'Overlay');
        expect(store.getState().currentDoc!.layers).toHaveLength(before + 1);
        expect(store.getState().selectedLayerId).toBe(id);
        const added = store.getState().currentDoc!.layers.find(l => l.id === id)!;
        expect(added.name).toBe('Overlay');
        expect(added).toMatchObject({ visible: true, blendMode: 'normal' });
    });

    it('addTextLayer appends a text layer and selects it', () => {
        store.getState().openImage('a.png', 'p');
        const before = store.getState().currentDoc!.layers.length;
        const id = store.getState().addTextLayer({
            fontId: 'font_1', text: 'INDII', fontSize: 48, letterSpacing: 0, kerning: true,
            fill: '#ffffff', x: 10, y: 20, rotation: 0, opacity: 1, visible: true,
        });
        expect(store.getState().currentDoc!.layers).toHaveLength(before + 1);
        expect(store.getState().selectedLayerId).toBe(id);
        const added = store.getState().currentDoc!.layers.find(l => l.id === id)!;
        expect(added.kind).toBe('text');
        expect(added).toMatchObject({ x: 10, y: 20, rotation: 0, opacity: 1, visible: true });
    });

    it('setAdjustments merges immutably', () => {
        store.getState().openImage('a.png', 'p');
        const id = store.getState().currentDoc!.layers[0]!.id;
        const before = store.getState().currentDoc!.layers[0]!;
        store.getState().setAdjustments(id, { brightness: 0.5 });
        const after = store.getState().currentDoc!.layers[0] as RasterLayer;
        expect(after).not.toBe(before);
        expect(after.adjustments.brightness).toBe(0.5);
        expect(after.adjustments.saturation).toBe(0);
    });

    it('updateLayer toggles visibility without mutating source', () => {
        store.getState().openImage('a.png', 'p');
        const id = store.getState().currentDoc!.layers[0]!.id;
        store.getState().updateLayer(id, { visible: false });
        expect(store.getState().currentDoc!.layers[0]!.visible).toBe(false);
    });

    it('reorderLayer respects bounds and is a no-op out of range', () => {
        store.getState().openImage('a.png', 'p');
        store.getState().addRasterLayer('b.png', 'B');
        store.getState().addRasterLayer('c.png', 'C');
        const first = store.getState().currentDoc!.layers[0]!.id;

        store.getState().reorderLayer(first, 999); // clamp to last
        const layers = store.getState().currentDoc!.layers;
        expect(layers[layers.length - 1]!.id).toBe(first);

        const before = store.getState().currentDoc!;
        store.getState().reorderLayer('nonexistent', 0);
        expect(store.getState().currentDoc).toBe(before); // no-op, same ref
    });

    it('removeLayer removes and re-selects the first remaining', () => {
        store.getState().openImage('a.png', 'p');
        store.getState().addRasterLayer('b.png', 'B');
        const a = store.getState().currentDoc!.layers[0]!.id;
        store.getState().selectLayer(a);
        store.getState().removeLayer(a);
        const doc = store.getState().currentDoc!;
        expect(doc.layers).toHaveLength(1);
        expect(doc.layers[0]!.id).not.toBe(a);
        expect(store.getState().selectedLayerId).toBe(doc.layers[0]!.id);
    });

    it('closeDoc resets state', () => {
        store.getState().openImage('a.png', 'p');
        store.getState().closeDoc();
        expect(store.getState().currentDoc).toBeNull();
        expect(store.getState().selectedLayerId).toBeNull();
    });
});
