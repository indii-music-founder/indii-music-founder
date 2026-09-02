import type { StateCreator } from 'zustand';
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
    selectedLayerId: string | null;
    openDoc: (doc: CanvasDoc) => void;
    openImage: (src: string, projectId: string) => void;
    addRasterLayer: (src: string, name?: string) => string | null;
    addTextLayer: (typography: Omit<TypographyLayer, 'id' | 'kind'>) => string | null;
    updateLayer: (id: string, patch: Partial<CanvasLayer>) => void;
    setAdjustments: (layerId: string, patch: Partial<AdjustmentStack>) => void;
    reorderLayer: (id: string, toIndex: number) => void;
    removeLayer: (id: string) => void;
    selectLayer: (id: string | null) => void;
    closeDoc: () => void;
}

export const createCanvasEditorSlice: StateCreator<StoreState, [], [], CanvasEditorSlice> = (set, get) => ({
    currentDoc: null,
    selectedLayerId: null,

    openDoc: (doc) => set({ currentDoc: doc, selectedLayerId: doc.layers[0]?.id ?? null }),

    openImage: (src, projectId) => {
        const doc = createDocFromImage(src, projectId);
        set({ currentDoc: doc, selectedLayerId: doc.layers[0]?.id ?? null });
    },

    addRasterLayer: (src, name) => {
        const doc = get().currentDoc;
        if (!doc) return null;
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
            src,
            adjustments: { brightness: 0, contrast: 0, saturation: 0, hue: 0, temperature: 0, exposure: 0, blur: 0, vignette: 0 }
        };
        set({ currentDoc: { ...doc, layers: [...doc.layers, layer], updatedAt: Date.now() }, selectedLayerId: id });
        return id;
    },

    addTextLayer: (typography) => {
        const doc = get().currentDoc;
        if (!doc) return null;
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
            typography: { ...typography, id, kind: 'text' }
        };
        set({ currentDoc: { ...doc, layers: [...doc.layers, layer], updatedAt: Date.now() }, selectedLayerId: id });
        return id;
    },

    updateLayer: (id, patch) => {
        const doc = get().currentDoc;
        if (!doc) return;
        set({
            currentDoc: {
                ...doc,
                layers: doc.layers.map(l => (l.id === id ? { ...l, ...patch } as CanvasLayer : l)),
                updatedAt: Date.now()
            },
            selectedLayerId: get().selectedLayerId === id ? id : get().selectedLayerId
        });
    },

    setAdjustments: (layerId, patch) => {
        const doc = get().currentDoc;
        if (!doc) return;
        set({
            currentDoc: {
                ...doc,
                layers: doc.layers.map(l => (
                    l.id === layerId && l.kind === 'raster'
                        ? { ...l, adjustments: mergeAdjustments(l.adjustments, patch) }
                        : l
                )),
                updatedAt: Date.now()
            }
        });
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
        set({ currentDoc: { ...doc, layers, updatedAt: Date.now() } });
    },

    removeLayer: (id) => {
        const doc = get().currentDoc;
        if (!doc) return;
        const layers = doc.layers.filter(l => l.id !== id);
        set({
            currentDoc: { ...doc, layers, updatedAt: Date.now() },
            selectedLayerId: get().selectedLayerId === id ? (layers[0]?.id ?? null) : get().selectedLayerId
        });
    },

    selectLayer: (id) => set({ selectedLayerId: id }),

    closeDoc: () => set({ currentDoc: null, selectedLayerId: null })
});
