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

    it('adds a replacement photo behind the cutout and text as one undoable edit', () => {
        store.getState().openImage('portrait.png', 'social');
        const portraitId = store.getState().selectedLayerId!;
        store.getState().updateLayer(portraitId, { maskSrc: 'artist-mask.png', subjectIsolated: true });
        const textId = store.getState().addTextLayer({ fontId: 'font_1', text: 'ARTIST', fontSize: 48,
            letterSpacing: 0, kerning: true, fill: '#ffffff', x: 10, y: 20, rotation: 0, opacity: 1, visible: true })!;
        const before = store.getState().currentDoc!;
        const backgroundId = store.getState().addRasterLayer('new-scene.png', 'New scene', 'background')!;
        const doc = store.getState().currentDoc!;
        expect(doc.layers.map(layer => layer.id)).toEqual([backgroundId, portraitId, textId]);
        expect(doc.layers[0]).toMatchObject({ kind: 'raster', framing: 'fill', src: 'new-scene.png' });
        expect(doc.layers[1]).toMatchObject({ maskSrc: 'artist-mask.png', subjectIsolated: true });
        store.getState().undoArtwork();
        expect(store.getState().currentDoc?.layers).toEqual(before.layers);
        store.getState().redoArtwork();
        expect(store.getState().currentDoc?.layers.map(layer => layer.id)).toEqual([backgroundId, portraitId, textId]);
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

    it("adds centered cover text as one undoable action while preserving other callers' origins", () => {
        store.getState().openImage('literal.png', 'literal');
        const typography = { fontId: 'builtin:montserrat', text: 'Artist name', fontSize: 180, letterSpacing: 0, kerning: true,
            fill: '#ffffff', x: 1500, y: 2340, rotation: 0, opacity: 1, visible: true };
        const id = store.getState().addTextLayer(typography, 'center');
        expect(store.getState().currentDoc!.layers.find(layer => layer.id === id)).toMatchObject({ transformAnchor: 'center', x: 1500, y: 2340 });
        expect(store.getState().canvasPast).toHaveLength(1);
        store.getState().undoArtwork();
        expect(store.getState().currentDoc!.layers).toHaveLength(1);
        store.getState().redoArtwork();
        expect(store.getState().currentDoc!.layers.find(layer => layer.id === id)?.transformAnchor).toBe('center');
        const other = store.getState().addTextLayer(typography);
        expect(store.getState().currentDoc!.layers.find(layer => layer.id === other)?.transformAnchor).toBe('top-left');
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

describe('artwork revision history', () => {
    it('groups a slider gesture and preserves redo when a later gesture is cancelled', () => {
        const store = buildStore();
        store.getState().openImage('portrait.png', 'release');
        const id = store.getState().selectedLayerId!;
        store.getState().beginCanvasGesture();
        for (const contrast of [0.1, 0.2, 0.3]) store.getState().setAdjustments(id, { contrast });
        store.getState().commitCanvasGesture();
        expect(store.getState().canvasPast).toHaveLength(1);
        store.getState().undoArtwork();
        expect((store.getState().currentDoc!.layers[0] as RasterLayer).adjustments.contrast).toBe(0);
        const undoneTimestamp = store.getState().currentDoc!.updatedAt;
        store.getState().beginCanvasGesture();
        store.getState().updateLayer(id, { x: 120 });
        store.getState().cancelCanvasGesture();
        expect(store.getState().currentDoc!.layers[0]!.x).toBe(0);
        store.getState().redoArtwork();
        expect((store.getState().currentDoc!.layers[0] as RasterLayer).adjustments.contrast).toBe(0.3);
        expect(store.getState().currentDoc!.updatedAt).toBeGreaterThan(undoneTimestamp);
    });

    it('restores deleted layers and drops redo only after a substantive new edit', () => {
        const store = buildStore();
        store.getState().openImage('portrait.png', 'release');
        const second = store.getState().addRasterLayer('background.png')!;
        store.getState().removeLayer(second);
        store.getState().undoArtwork();
        expect(store.getState().currentDoc!.layers.map(l => l.id)).toContain(second);
        store.getState().selectLayer(second);
        store.getState().updateLayer(second, { x: 0 });
        expect(store.getState().canvasFuture).toHaveLength(1);
        store.getState().updateLayer(second, { x: 90 });
        expect(store.getState().canvasFuture).toHaveLength(0);
        store.getState().redoArtwork();
        expect(store.getState().currentDoc!.layers.find(l => l.id === second)!.x).toBe(90);
    });

    it('bounds retained revisions and isolates documents', () => {
        const store = buildStore();
        store.getState().openImage('portrait.png', 'release');
        const id = store.getState().selectedLayerId!;
        for (let x = 1; x <= 80; x++) store.getState().updateLayer(id, { x });
        expect(store.getState().canvasPast).toHaveLength(50);
        for (let i = 0; i < 60; i++) store.getState().undoArtwork();
        expect(store.getState().currentDoc!.layers[0]!.x).toBe(30);
        store.getState().openImage('new-photo.png', 'next-release');
        store.getState().undoArtwork();
        store.getState().redoArtwork();
        expect(store.getState().currentDoc!.projectId).toBe('next-release');
        expect(store.getState().canvasPast).toHaveLength(0);
        expect(store.getState().canvasFuture).toHaveLength(0);
    });
});

describe('square-cover framing', () => {
    it('keeps portrait resizing as one undoable edit without losing layers', () => {
        const store = buildStore();
        store.getState().openImage('literal-source.png', 'pure-layout');
        store.getState().addRasterLayer('literal-background.png', 'Replacement background');
        const original = store.getState().currentDoc!;
        store.getState().resizeArtwork(1080, 1350);
        const portrait = store.getState().currentDoc!;
        expect(portrait).toMatchObject({ width: 1080, height: 1350 });
        expect(portrait.layers.map(layer => layer.id)).toEqual(original.layers.map(layer => layer.id));
        store.getState().undoArtwork();
        expect(store.getState().currentDoc?.layers).toEqual(original.layers);
        expect(store.getState().currentDoc).toMatchObject({ width: 3000, height: 3000 });
        store.getState().redoArtwork();
        expect(store.getState().currentDoc?.layers).toEqual(portrait.layers);
        expect(store.getState().currentDoc).toMatchObject({ width: 1080, height: 1350 });
    });
    it('crops a rectangular document uniformly without stretching its photo', () => {
        const store = buildStore();
        store.getState().openImage('geometry-fixture.png', 'unit-fixture');
        const original = store.getState().currentDoc!;
        store.getState().openDoc({ ...original, width: 1200, height: 800, layers: original.layers.map(layer => ({ ...layer, framing: undefined, x: 100, y: 50, scaleX: 1.4, scaleY: 1.4 })) });
        store.getState().resizeArtwork(3000);
        const doc = store.getState().currentDoc!;
        expect([doc.width, doc.height]).toEqual([3000, 3000]);
        expect(doc.layers[0]).toMatchObject({ x: -375, y: 187.5, scaleX: 5.25, scaleY: 5.25 });
        store.getState().undoArtwork();
        expect(store.getState().currentDoc).toMatchObject({ width: 1200, height: 800 });
    });
});
