import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fabric from 'fabric';
import { renderHook } from '@testing-library/react';
import { useCanvasControls } from '../DesignCanvas';

// Mock fabric
vi.mock('fabric', () => {
    return {
        Canvas: class {
            width = 800;
            height = 1000;
            viewportTransform = [1, 0, 0, 1, 0, 0];
            getZoom = vi.fn().mockReturnValue(1);
            setZoom = vi.fn();
            setDimensions = vi.fn();
            setViewportTransform = vi.fn();
            toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock');
            toSVG = vi.fn().mockReturnValue('<svg>mock</svg>');
            getObjects = vi.fn().mockReturnValue([]);
            add = vi.fn();
            setActiveObject = vi.fn();
            renderAll = vi.fn();
            requestRenderAll = vi.fn();
        },
        FabricImage: {
            fromURL: vi.fn().mockResolvedValue({
                width: 100,
                height: 100,
                scaleX: 1,
                scaleY: 1,
                set: vi.fn(),
            }),
        },
        IText: class {
            constructor(text: string, options: any) {
                Object.assign(this, options);
            }
            set = vi.fn();
        },
        Object: {
            prototype: {
                set: vi.fn(),
            },
        },
    };
});

describe('DesignCanvas Export Logic', () => {
    let mockCanvas: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCanvas = new fabric.Canvas(null as any);
    });

    it('should reset zoom and dimensions during raster export', async () => {
        const { result } = renderHook(() => useCanvasControls(mockCanvas));

        // Simulate a zoomed/responsive state
        mockCanvas.viewportTransform = [0.5, 0, 0, 0.5, 12, 24];
        mockCanvas.width = 400;
        mockCanvas.height = 500;

        await result.current.exportToImage('png');

        // Verify reset occurred before export
        expect(mockCanvas.setViewportTransform).toHaveBeenNthCalledWith(1, [1, 0, 0, 1, 0, 0]);
        expect(mockCanvas.setDimensions).toHaveBeenNthCalledWith(1, { width: 800, height: 1000 });

        // Verify toDataURL was called
        expect(mockCanvas.toDataURL).toHaveBeenCalled();

        // Verify state was restored AFTER export
        expect(mockCanvas.setViewportTransform).toHaveBeenNthCalledWith(2, [0.5, 0, 0, 0.5, 12, 24]);
        expect(mockCanvas.setDimensions).toHaveBeenNthCalledWith(2, { width: 400, height: 500 });
    });

    it('should handle missing width/height during restoration', async () => {
        const { result } = renderHook(() => useCanvasControls(mockCanvas));

        mockCanvas.getZoom.mockReturnValue(0.5);
        mockCanvas.width = undefined;
        mockCanvas.height = undefined;

        await result.current.exportToImage('png');

        expect(mockCanvas.setDimensions).toHaveBeenNthCalledWith(2, { width: 400, height: 500 });
    });

    it('should use document dimensions for SVG export', async () => {
        const { result } = renderHook(() => useCanvasControls(mockCanvas));

        await result.current.exportToImage('svg');

        expect(mockCanvas.toSVG).toHaveBeenCalled();
        expect(mockCanvas.setDimensions).toHaveBeenNthCalledWith(1, { width: 800, height: 1000 });
    });
});
