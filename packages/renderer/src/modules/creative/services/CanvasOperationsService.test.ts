import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasOperationsService, CANVAS_SERIALIZATION_PROPERTIES } from './CanvasOperationsService';

let mockCanvasInstance: any;

vi.mock('fabric', () => {
    class MockCanvas {
        objects: any[] = [];
        width = 800;
        height = 600;
        activeObject: any = null;
        backgroundColor = '#1a1a1a';
        viewportTransform = [1, 0, 0, 1, 0, 0];
        on = vi.fn();
        off = vi.fn();
        dispose = vi.fn();
        add = vi.fn((obj: any) => {
            this.objects.push(obj);
            return this;
        });
        remove = vi.fn((obj: any) => {
            this.objects = this.objects.filter((item) => item !== obj);
        });
        renderAll = vi.fn();
        setDimensions = vi.fn(({ width, height }: { width: number; height: number }) => { this.width = width; this.height = height; });
        set = vi.fn();
        toObject = vi.fn(() => ({ objects: this.objects.map((obj) => ({ id: obj.id, data: obj.data, type: obj.type })) }));
        toDataURL = vi.fn(() => 'data:image/png;base64,export');
        loadFromJSON = vi.fn();
        getObjects = vi.fn(() => this.objects);
        getActiveObject = vi.fn(() => this.activeObject);
        setActiveObject = vi.fn((obj: any) => {
            this.activeObject = obj;
        });
        discardActiveObject = vi.fn();
        centerObject = vi.fn();
        bringObjectForward = vi.fn();
        sendObjectBackwards = vi.fn();
        getWidth = vi.fn(() => this.width);
        getHeight = vi.fn(() => this.height);

        constructor() {
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            mockCanvasInstance = this;
        }
    }

    class MockPath {
        type = 'path';
        constructor(path: string, options: Record<string, unknown>) {
            Object.assign(this, { path, ...options });
        }
    }

    class MockGroup {
        scale = vi.fn();
        removeAll = vi.fn();
        setCoords = vi.fn();
        constructor(_objects: unknown[]) {}
    }

    return {
        Canvas: MockCanvas,
        Path: MockPath,
        Group: MockGroup,
        util: {
            transformPoint: (p: { x: number; y: number }, m: number[]) => ({ x: p.x * m[0] + p.y * m[2] + m[4], y: p.x * m[1] + p.y * m[3] + m[5] }),
        },
    };
});

describe('CanvasOperationsService blank sketch layers', () => {
    afterEach(() => {
        mockCanvasInstance = null;
    });

    it('adds a labeled blank sketch layer that appears in the layer list', () => {
        const service = new CanvasOperationsService();
        const wrapper = document.createElement('div');
        wrapper.style.width = '800px';
        wrapper.style.height = '600px';
        const canvasEl = document.createElement('canvas');
        wrapper.appendChild(canvasEl);
        document.body.appendChild(wrapper);

        service.initialize(canvasEl);
        const layerId = service.addBlankSketchLayer('Sketch Layer');

        expect(layerId).toEqual(expect.any(String));
        expect(mockCanvasInstance.add).toHaveBeenCalledOnce();

        const createdLayer = mockCanvasInstance.add.mock.calls[0][0];
        expect(createdLayer.data).toMatchObject({
            isAnnotation: true,
            isSketchLayer: true,
            label: 'Sketch Layer',
        });

        const layers = service.getLayers();
        expect(layers).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Sketch Layer',
                    type: 'path',
                }),
            ])
        );
    });

    it('serializes annotation identity when exporting so restores do not turn edits into artwork', () => {
        expect(CANVAS_SERIALIZATION_PROPERTIES).toEqual(['data', 'id']);
    });

    it('restores saved portrait dimensions instead of keeping the wider viewport', async () => {
        const service = new CanvasOperationsService();
        service.initialize(document.createElement('canvas'));
        await service.loadFromJSON(JSON.stringify({ width: 388, height: 690, objects: [] }));
        expect(mockCanvasInstance.setDimensions).toHaveBeenCalledWith({ width: 388, height: 690 });
        expect(mockCanvasInstance.getWidth()).toBe(388);
        expect(mockCanvasInstance.getHeight()).toBe(690);
    });

    it('exports a 4:5 Instagram derivative and preserves identity in every restore snapshot', async () => {
        const service = new CanvasOperationsService();
        const wrapper = document.createElement('div');
        wrapper.style.width = '800px';
        wrapper.style.height = '600px';
        const canvasEl = document.createElement('canvas');
        wrapper.appendChild(canvasEl);
        document.body.appendChild(wrapper);
        service.initialize(canvasEl);

        const result = await service.exportBatchDimensions();

        expect(result?.instagram).toContain('data:image/png');
        expect(mockCanvasInstance.setDimensions).toHaveBeenCalledWith({ width: 1080, height: 1350 });
        expect(mockCanvasInstance.toObject).toHaveBeenCalledWith(['data', 'id']);
    });

    it('saves only the base image area at its native size (no fitting padding)', () => {
        const service = new CanvasOperationsService();
        const canvasEl = document.createElement('canvas');
        document.body.appendChild(canvasEl);
        service.initialize(canvasEl);
        mockCanvasInstance.width = 638;
        mockCanvasInstance.height = 638;
        const scale = 598 / 3000;
        mockCanvasInstance.objects.push({
            type: 'image',
            data: { isBaseImage: true },
            scaleX: scale,
            getCoords: () => [{ x: 20, y: 20 }, { x: 618, y: 20 }, { x: 618, y: 618 }, { x: 20, y: 618 }],
        });

        service.saveCanvas();

        const options = mockCanvasInstance.toDataURL.mock.calls.at(-1)[0];
        expect(options).toMatchObject({ format: 'png', left: 20, top: 20, width: 598, height: 598 });
        expect(Math.trunc(options.width * options.multiplier)).toBe(3000);
    });
});
