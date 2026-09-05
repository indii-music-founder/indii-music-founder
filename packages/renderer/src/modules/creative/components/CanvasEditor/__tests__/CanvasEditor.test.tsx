import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CanvasEditor } from '../CanvasEditor';
import { createDocFromImage } from '@/services/canvas/CanvasDoc';

const { mockStoreStateRef, mockCanvasRef, mockDownloadAsset, mockSaveDoc } = vi.hoisted(() => ({
    mockStoreStateRef: { current: {} as Record<string, unknown> },
    mockCanvasRef: { current: null as null | { toDataURL: ReturnType<typeof vi.fn> } },
    mockDownloadAsset: vi.fn(),
    mockSaveDoc: vi.fn(),
}));

// Store mock mirrors CreativeCanvas.test.tsx: `useStore` returns the whole
// current mock state so the component's useShallow selector destructures from it.
vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        () => mockStoreStateRef.current,
        { getState: () => mockStoreStateRef.current },
    ),
}));

vi.mock('@/utils/download', () => ({
    downloadAsset: mockDownloadAsset,
}));

// The autosave hook (C1.5) depends on the persistence service; isolate it so
// the component test never touches the real Firebase module.
vi.mock('@/services/canvas/CanvasDocumentService', () => ({
    CanvasDocumentService: { saveDoc: mockSaveDoc },
}));

vi.mock('@/services/storage/resolveStorageUrl', () => ({
    resolveStorageUrl: vi.fn((uri: string) => Promise.resolve(uri)),
}));

// PSD export has its own unit test; isolate the component test from ag-psd.
vi.mock('@/services/canvas/PsdExportService', () => ({
    canvasDocToPsd: vi.fn(),
}));

// Text rasterization pulls in FontLibrary (Firebase); isolate the component test.
vi.mock('@/services/canvas/textLayerRaster', () => ({
    rasterizeTextLayer: vi.fn(async () => ({ dataUrl: 'data:image/png;base64,AAA', width: 8, height: 8 })),
    rasterizeTextLayerToRaster: vi.fn(),
    dataUrlToRaster: vi.fn(),
}));

vi.mock('fabric', () => {
    const makeFilter = () => vi.fn();
    return {
        Canvas: vi.fn(function (this: unknown) {
            const instance = {
                setDimensions: vi.fn(),
                clear: vi.fn(),
                add: vi.fn(),
                renderAll: vi.fn(),
                on: vi.fn(),
                off: vi.fn(),
                dispose: vi.fn(),
                toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
            };
            mockCanvasRef.current = instance;
            return instance;
        }),
        Image: {
            fromURL: vi.fn(async (_src: string) => ({ set: vi.fn(), applyFilters: vi.fn() })),
        },
        filters: {
            Brightness: makeFilter(),
            Contrast: makeFilter(),
            Saturation: makeFilter(),
            HueRotation: makeFilter(),
            BlendColor: makeFilter(),
            Gamma: makeFilter(),
            Blur: makeFilter(),
            Convolute: makeFilter(),
            BaseFilter: class {},
        },
    };
});

describe('CanvasEditor (C1.3 layer editor RTL + C1.4 export)', () => {
    let updateLayer: ReturnType<typeof vi.fn>;
    let setAdjustments: ReturnType<typeof vi.fn>;
    let selectLayer: ReturnType<typeof vi.fn>;
    let closeDoc: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        updateLayer = vi.fn();
        setAdjustments = vi.fn();
        selectLayer = vi.fn();
        closeDoc = vi.fn();
        mockCanvasRef.current = null;
        mockDownloadAsset.mockReset().mockResolvedValue(true);
        mockSaveDoc.mockReset().mockResolvedValue(undefined);
        mockStoreStateRef.current = {
            currentDoc: null,
            selectedLayerId: null,
            updateLayer,
            setAdjustments,
            selectLayer,
            closeDoc,
        };
    });

    it('renders an empty state when no document is open', () => {
        render(<CanvasEditor />);
        expect(screen.getByTestId('canvas-editor-empty')).toBeDefined();
    });

    it('opens an image → layer list shows exactly one layer', () => {
        const doc = createDocFromImage('data:image/png;base64,AAA', 'proj_1');
        const layer = doc.layers[0]!;
        mockStoreStateRef.current = {
            ...mockStoreStateRef.current,
            currentDoc: doc,
            selectedLayerId: layer.id,
        };

        render(<CanvasEditor />);

        expect(screen.getByTestId('canvas-editor')).toBeDefined();
        expect(screen.getByTestId(`layer-row-${layer.id}`)).toBeDefined();
        expect(screen.getByText('Background')).toBeDefined();
    });

    it('toggles visibility and lock via updateLayer patches', () => {
        const doc = createDocFromImage('data:image/png;base64,AAA', 'proj_1');
        const layer = doc.layers[0]!;
        mockStoreStateRef.current = {
            ...mockStoreStateRef.current,
            currentDoc: doc,
            selectedLayerId: layer.id,
        };

        render(<CanvasEditor />);

        fireEvent.click(screen.getByTestId(`layer-visibility-${layer.id}`));
        expect(updateLayer).toHaveBeenCalledWith(layer.id, { visible: false });

        fireEvent.click(screen.getByTestId(`layer-lock-${layer.id}`));
        expect(updateLayer).toHaveBeenCalledWith(layer.id, { locked: true });
    });

    it('adjustment slider dispatches setAdjustments for the selected layer', () => {
        const doc = createDocFromImage('data:image/png;base64,AAA', 'proj_1');
        const layer = doc.layers[0]!;
        mockStoreStateRef.current = {
            ...mockStoreStateRef.current,
            currentDoc: doc,
            selectedLayerId: layer.id,
        };

        render(<CanvasEditor />);

        const slider = screen.getByTestId('adjust-brightness') as HTMLInputElement;
        fireEvent.change(slider, { target: { value: '0.4' } });

        expect(setAdjustments).toHaveBeenCalledWith(layer.id, { brightness: 0.4 });
    });

    it('exports at the selected scale via canvas.toDataURL and downloads (C1.4)', async () => {
        const doc = createDocFromImage('data:image/png;base64,AAA', 'proj_1');
        const layer = doc.layers[0]!;
        mockStoreStateRef.current = {
            ...mockStoreStateRef.current,
            currentDoc: doc,
            selectedLayerId: layer.id,
        };

        render(<CanvasEditor />);

        // Default export settings: PNG at 2×.
        fireEvent.click(screen.getByTestId('canvas-export'));

        const { getViewportProxy } = await import('../CanvasEditor');
        const { proxyScale } = getViewportProxy(doc.width, doc.height);
        await waitFor(() => {
            expect(mockCanvasRef.current?.toDataURL).toHaveBeenCalledWith({ format: 'png', multiplier: 2 / proxyScale });
        });
        await waitFor(() => {
            expect(mockDownloadAsset).toHaveBeenCalledWith('data:image/png;base64,mock', expect.stringMatching(/^canvas-/));
        });
    });
});
