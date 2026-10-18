import type { StateCreator } from 'zustand';
import { normalizeCanvasDoc } from '@/services/canvas/CanvasDocValidation';
import type { StoreState } from '@/core/store/types';
import {
    createDocFromImage,
    mergeAdjustments,
    type AdjustmentStack,
    type CanvasDoc,
    type CanvasLayer,
    type TextLayer,
    type TypographyLayer
} from '@/services/canvas/CanvasDoc';

export interface CanvasEditorSlice {
    currentDoc: CanvasDoc | null;
    canvasPast: CanvasDoc[];
    canvasFuture: CanvasDoc[];
    canvasGesture: CanvasDoc | null;
    beginCanvasGesture: () => void;
    commitCanvasGesture: () => void;
    cancelCanvasGesture: () => void;
    undoCanvas: () => void;
    redoCanvas: () => void;
    selectedLayerId: string | null;
    openDoc: (doc: CanvasDoc) => void;
    openImage: (src: string, projectId: string) => void;
    addRasterLayer: (src: string, name?: string) => string | null;
    addTextLayer: (typography: Omit<TypographyLayer, 'id' | 'kind'>, anchor?: 'center' | 'top-left') => string | null;
    updateLayer: (id: string, patch: Partial<CanvasLayer>) => void;
    setAdjustments: (layerId: string, patch: Partial<AdjustmentStack>) => void;
    reorderLayer: (id: string, toIndex: number) => void;
    removeLayer: (id: string) => void;
    selectLayer: (id: string | null) => void;
    closeDoc: () => void;
    updateArtwork: (patch: Partial<Pick<CanvasDoc, 'name' | 'background'>>) => void;
    resizeArtwork: (size: number) => void;
    duplicateArtworkLayer: (id: string) => void;
}

const HISTORY_LIMIT = 50;

function sameArtwork(a: CanvasDoc, b: CanvasDoc): boolean {
    return JSON.stringify({ ...a, updatedAt: 0, revision: 0 }) === JSON.stringify({ ...b, updatedAt: 0, revision: 0 });
}

export const createCanvasEditorSlice: StateCreator<StoreState, [], [], CanvasEditorSlice> = (set, get) => {
    const edit = (next: CanvasDoc, selectedLayerId = get().selectedLayerId) => {
        const state = get();
        const previous = state.currentDoc;
        if (!previous || sameArtwork(previous, next)) return;
        set({
            currentDoc: { ...next, updatedAt: Math.max(Date.now(), previous.updatedAt + 1), revision: (previous.revision ?? 0) + 1 },
            selectedLayerId,
            canvasPast: state.canvasGesture ? state.canvasPast : [...state.canvasPast, previous].slice(-HISTORY_LIMIT),
            canvasFuture: state.canvasGesture ? state.canvasFuture : [],
        });
    };
    const restore = (doc: CanvasDoc) => ({
        currentDoc: { ...doc, updatedAt: Math.max(Date.now(), (get().currentDoc?.updatedAt ?? 0) + 1), revision: (get().currentDoc?.revision ?? 0) + 1 },
        selectedLayerId: doc.layers.some(l => l.id === get().selectedLayerId) ? get().selectedLayerId : doc.layers[0]?.id ?? null,
    });
    return ({
    currentDoc: null,
    selectedLayerId: null,
    canvasPast: [],
    canvasFuture: [],
    canvasGesture: null,
    beginCanvasGesture: () => {
        if (!get().canvasGesture && get().currentDoc) set({ canvasGesture: get().currentDoc });
    },
    commitCanvasGesture: () => {
        const { canvasGesture, currentDoc, canvasPast, canvasFuture } = get();
        if (!canvasGesture) return;
        set({
            canvasGesture: null,
            canvasFuture: currentDoc && !sameArtwork(canvasGesture, currentDoc) ? [] : canvasFuture,
            canvasPast: currentDoc && !sameArtwork(canvasGesture, currentDoc)
                ? [...canvasPast, canvasGesture].slice(-HISTORY_LIMIT) : canvasPast,
        });
    },
    cancelCanvasGesture: () => {
        const original = get().canvasGesture;
        if (original) {
            if (get().currentDoc && sameArtwork(original, get().currentDoc!)) set({ canvasGesture: null });
            else set({ ...restore(original), canvasGesture: null });
        }
    },
    undoCanvas: () => {
        get().commitCanvasGesture();
        const { currentDoc, canvasPast, canvasFuture } = get();
        const previous = canvasPast.at(-1);
        if (!currentDoc || !previous) return;
        set({ ...restore(previous), canvasPast: canvasPast.slice(0, -1), canvasFuture: [currentDoc, ...canvasFuture].slice(0, HISTORY_LIMIT) });
    },
    redoCanvas: () => {
        get().commitCanvasGesture();
        const { currentDoc, canvasPast, canvasFuture } = get();
        const next = canvasFuture[0];
        if (!currentDoc || !next) return;
        set({ ...restore(next), canvasPast: [...canvasPast, currentDoc].slice(-HISTORY_LIMIT), canvasFuture: canvasFuture.slice(1) });
    },

    openDoc: (document) => {
        const doc = normalizeCanvasDoc(document);
        set({ currentDoc: doc, selectedLayerId: doc.layers[0]?.id ?? null, canvasPast: [], canvasFuture: [], canvasGesture: null });
    },

    openImage: (src, projectId) => {
        const doc = createDocFromImage(src, projectId);
        set({ currentDoc: doc, selectedLayerId: doc.layers[0]?.id ?? null, canvasPast: [], canvasFuture: [], canvasGesture: null });
    },

    addRasterLayer: (src, name) => {
        const doc = get().currentDoc;
        if (!doc || doc.layers.length >= 100) return null;
        const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const layer: CanvasLayer = {
            id,
            name: name ?? `Layer ${doc.layers.length + 1}`,
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'normal',
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            kind: 'raster',
            transformAnchor: 'top-left',
            adjustmentVersion: 2,
            framing: 'fit',
            src,
            adjustments: { brightness: 0, contrast: 0, saturation: 0, hue: 0, temperature: 0, exposure: 0, blur: 0, vignette: 0 }
        };
        edit({ ...doc, layers: [...doc.layers, layer] }, id);
        return id;
    },

    addTextLayer: (typography, anchor = 'top-left') => {
        const doc = get().currentDoc;
        if (!doc || doc.layers.length >= 100) return null;
        const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const layer: TextLayer = {
            id,
            name: `Text ${doc.layers.length + 1}`,
            visible: typography.visible ?? true,
            locked: false,
            opacity: typography.opacity ?? 1,
            blendMode: 'normal',
            x: typography.x ?? 0,
            y: typography.y ?? 0,
            scaleX: 1,
            scaleY: 1,
            rotation: typography.rotation ?? 0,
            kind: 'text',
            transformAnchor: anchor,
            rasterScale: 1,
            typography: { ...typography, id, kind: 'text' }
        };
        edit({ ...doc, layers: [...doc.layers, layer] }, id);
        return id;
    },

    updateLayer: (id, patch) => {
        const doc = get().currentDoc;
        if (!doc) return;
        edit({ ...doc, layers: doc.layers.map(l => l.id === id ? { ...l, ...patch, id: l.id, kind: l.kind } as CanvasLayer : l) });
    },

    setAdjustments: (layerId, patch) => {
        const doc = get().currentDoc;
        if (!doc) return;
        edit({ ...doc, layers: doc.layers.map(l => l.id === layerId && l.kind === 'raster'
            ? { ...l, adjustments: mergeAdjustments(l.adjustments, patch) } : l) });
    },

    reorderLayer: (id, toIndex) => {
        const doc = get().currentDoc;
        if (!doc) return;
        const from = doc.layers.findIndex(l => l.id === id);
        if (from < 0) return;
        const clamped = Math.max(0, Math.min(doc.layers.length - 1, toIndex));
        if (from === clamped) return;
        const layers = [...doc.layers];
        const [moved] = layers.splice(from, 1);
        layers.splice(clamped, 0, moved!);
        edit({ ...doc, layers });
    },

    removeLayer: (id) => {
        const doc = get().currentDoc;
        if (!doc) return;
        const layers = doc.layers.filter(l => l.id !== id);
        edit({ ...doc, layers }, get().selectedLayerId === id ? layers[0]?.id ?? null : get().selectedLayerId);
    },

    selectLayer: (id) => set({ selectedLayerId: id }),

    updateArtwork: (patch) => {
        const doc = get().currentDoc;
        if (doc) edit({ ...doc, ...patch });
    },
    resizeArtwork: (size) => {
        const doc = get().currentDoc;
        if (!doc || !Number.isInteger(size) || size < 64 || size > 6000) return;
        const ratio = size / Math.min(doc.width, doc.height);
        const layers = doc.layers.map(layer => {
            const base = { ...layer, x: (layer.x - doc.width / 2) * ratio + size / 2, y: (layer.y - doc.height / 2) * ratio + size / 2, scaleX: layer.scaleX * ratio, scaleY: layer.scaleY * ratio };
            return base as CanvasLayer;
        });
        edit({ ...doc, width: size, height: size, layers });
    },
    duplicateArtworkLayer: (id) => {
        const doc = get().currentDoc;
        const layer = doc?.layers.find(item => item.id === id);
        if (!doc || !layer || doc.layers.length >= 100) return;
        const newId = `layer_${crypto.randomUUID()}`;
        const copy: CanvasLayer = layer.kind === 'text'
            ? { ...layer, id: newId, name: `${layer.name} copy`, x: layer.x + 40, y: layer.y + 40, typography: { ...layer.typography, id: newId } }
            : { ...layer, id: newId, name: `${layer.name} copy`, x: layer.x + 40, y: layer.y + 40 };
        const layers = [...doc.layers];
        layers.splice(layers.findIndex(item => item.id === id) + 1, 0, copy);
        edit({ ...doc, layers }, newId);
    },
    closeDoc: () => set({ currentDoc: null, selectedLayerId: null, canvasPast: [], canvasFuture: [], canvasGesture: null })
    });
};
