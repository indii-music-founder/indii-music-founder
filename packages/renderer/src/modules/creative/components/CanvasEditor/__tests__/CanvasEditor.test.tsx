import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasEditor } from '../CanvasEditor';
import { createDocFromImage } from '@/services/canvas/CanvasDoc';

const { mockStoreStateRef } = vi.hoisted(() => ({
    mockStoreStateRef: { current: {} as Record<string, unknown> },
}));

// Store mock mirrors CreativeCanvas.test.tsx: `useStore` returns the whole
// current mock state so the component's useShallow selector destructures from it.
vi.mock('@/core/store', () => ({
    useStore: Object.assign(
        () => mockStoreStateRef.current,
        { getState: () => mockStoreStateRef.current },
    ),
}));

vi.mock('fabric', () => {
    const makeFilter = () => vi.fn();
    return {
        Canvas: vi.fn(function (this: unknown) {
            return {
                setDimensions: vi.fn(),
                clear: vi.fn(),
                add: vi.fn(),
                renderAll: vi.fn(),
                on: vi.fn(),
                off: vi.fn(),
                dispose: vi.fn(),
                toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
            };
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

describe('CanvasEditor (C1.3 — layer editor RTL)', () => {
    let updateLayer: ReturnType<typeof vi.fn>;
    let setAdjustments: ReturnType<typeof vi.fn>;
    let selectLayer: ReturnType<typeof vi.fn>;
    let closeDoc: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        updateLayer = vi.fn();
        setAdjustments = vi.fn();
        selectLayer = vi.fn();
        closeDoc = vi.fn();
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
});
