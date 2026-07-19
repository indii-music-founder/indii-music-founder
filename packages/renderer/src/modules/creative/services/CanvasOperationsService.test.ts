import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasOperationsService } from './CanvasOperationsService';

let mockCanvasInstance: any;

vi.mock('fabric', () => {
    class MockCanvas {
        objects: any[] = [];
        width = 800;
        height = 600;
        activeObject: any = null;
        backgroundColor = '#1a1a1a';
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
        setDimensions = vi.fn();
        set = vi.fn();
        toJSON = vi.fn(() => ({ objects: this.objects.map((obj) => ({ id: obj.id, data: obj.data, type: obj.type })) }));
        getObjects = vi.fn(() => this.objects);
        getActiveObject = vi.fn(() => this.activeObject);
        setActiveObject = vi.fn((obj: any) => {
            this.activeObject = obj;
        });
        discardActiveObject = vi.fn();
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

    return {
        Canvas: MockCanvas,
        Path: MockPath,
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
});
