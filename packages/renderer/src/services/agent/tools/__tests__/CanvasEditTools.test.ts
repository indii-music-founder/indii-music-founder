import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the store slice funcs used by the canvas editing tools.
const openImage = vi.fn();
const addRasterLayer = vi.fn();
const setAdjustments = vi.fn();
const addToHistory = vi.fn();

vi.mock('@/core/store', () => {
    // We capture the mock funcs into a module var and expose a mutable store.
    const store = {
        currentDoc: null, selectedLayerId: null,
        generatedHistory: [{ url: 'data:image/png;base64,SUBJECT' }],
        uploadedImages: [], currentProjectId: 'proj_1',
        openImage: (...a: unknown[]) => openImage(...a),
        addRasterLayer: (...a: unknown[]) => addRasterLayer(...a),
        setAdjustments: (...a: unknown[]) => setAdjustments(...a),
        addToHistory: (...a: unknown[]) => addToHistory(...a),
        openDoc: vi.fn(),
        updateLayer: vi.fn(),
        selectLayer: vi.fn(),
        closeDoc: vi.fn(),
        removeLayer: vi.fn(),
        reorderLayer: vi.fn()
    };
    return { useStore: { getState: () => store } };
});

import { CanvasTools } from '../CanvasTools';

const t = (name: string) => (CanvasTools as unknown as Record<string, (a: never) => Promise<{ success: boolean; data: Record<string, unknown>; message: string }>>)[name]!;

describe('CanvasTools C2 tools', () => {
    beforeEach(() => vi.clearAllMocks());

    it('canvas_open_image opens the indexed image into a doc', async () => {
        const res = await t('canvas_open_image')({ imageIndex: 0 } as never);
        expect(res.success).toBe(true);
        expect(openImage).toHaveBeenCalledWith('data:image/png;base64,SUBJECT', 'proj_1');
    });

    it('canvas_add_layer adds a raster layer to the open doc', async () => {
        const doc = { id: 'doc_1', width: 1080, height: 1080, background: '#000', layers: [], projectId: 'p', updatedAt: 1 } as never;
        (CanvasTools as unknown as { _doc: unknown })._doc = doc;
        // Stub currentDoc via the store mock.
        const { useStore } = await import('@/core/store');
        (useStore.getState() as unknown as { currentDoc: unknown }).currentDoc = doc;
        addRasterLayer.mockReturnValue('layer_9');
        const res = await t('canvas_add_layer')({ docId: 'doc_1', imageIndex: 0 } as never);
        expect(res.success).toBe(true);
        expect(addRasterLayer).toHaveBeenCalledWith('data:image/png;base64,SUBJECT');
    });

    it('canvas_set_adjustments merges a partial patch', async () => {
        const { useStore } = await import('@/core/store');
        (useStore.getState() as unknown as { currentDoc: unknown }).currentDoc = { id: 'doc_1' };
        const res = await t('canvas_set_adjustments')({ docId: 'doc_1', layerId: 'L1', adjustments: { brightness: 0.3 } } as never);
        expect(res.success).toBe(true);
        expect(setAdjustments).toHaveBeenCalledWith('L1', { brightness: 0.3 });
    });

    it('canvas_export emits a history item with a canvas_export tag', async () => {
        const { useStore } = await import('@/core/store');
        (useStore.getState() as unknown as { currentDoc: unknown }).currentDoc = { id: 'doc_1', width: 100, height: 100, background: '#000', layers: [], projectId: 'proj_1', updatedAt: 1 };
        const res = await t('canvas_export')({ format: 'png', scale: 1 } as never);
        expect(res.success).toBe(true);
        expect(res.data.width).toBe(100);
        expect(addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            meta: expect.stringContaining('canvas_export')
        }));
    });

    it('fails when no doc is open', async () => {
        const { useStore } = await import('@/core/store');
        (useStore.getState() as unknown as { currentDoc: unknown }).currentDoc = null;
        const res = await t('canvas_export')({} as never);
        expect(res.success).toBe(false);
    });
});

describe('CanvasTools registration (C2.1)', () => {
    it('exposes all four canvas editing tools', () => {
        expect(CanvasTools.canvas_open_image).toBeDefined();
        expect(CanvasTools.canvas_add_layer).toBeDefined();
        expect(CanvasTools.canvas_set_adjustments).toBeDefined();
        expect(CanvasTools.canvas_export).toBeDefined();
    });
});
