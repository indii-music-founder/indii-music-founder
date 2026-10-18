import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CanvasOperationsService } from '../CanvasOperationsService';
import { logger } from '@/utils/logger';

// ISSUE-1391: "Failed to execute 'removeChild' on 'Node': The node to be
// removed is not a child of this node" — fabric.js re-parents the React-owned
// <canvas> into its own wrapper container; double-initialization wraps it
// twice, and dispose() racing React's unmount throws a raw DOM error. These
// tests pin the lifecycle guards: initialize() disposes a live instance
// first, and dispose() never throws even when fabric's own cleanup explodes.

vi.mock('fabric', () => {
    class FakeCanvas {
        on = vi.fn();
        off = vi.fn();
        dispose = vi.fn();
        toObject = vi.fn(() => ({}));
        getWidth = vi.fn(() => 400);
        getHeight = vi.fn(() => 600);
        getObjects = vi.fn(() => []);
        getElement = vi.fn(() => {
            const el = document.createElement('canvas');
            return el;
        });
    }
    return { Canvas: FakeCanvas, Image: class {}, PencilBrush: class {}, Rect: class {} };
});

vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('CanvasOperationsService lifecycle guards (ISSUE-1391)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    function mountCanvasElement(): HTMLCanvasElement {
        const wrapper = document.createElement('div');
        const el = document.createElement('canvas');
        wrapper.appendChild(el);
        document.body.appendChild(wrapper);
        return el;
    }

    it('disposes an existing instance before re-initializing the same element', () => {
        const service = new CanvasOperationsService();
        const el = mountCanvasElement();

        service.initialize(el, undefined, undefined, undefined);
        const first = (service as unknown as { canvas: { dispose: ReturnType<typeof vi.fn> } }).canvas;
        expect(first).toBeTruthy();

        // Second initialize on the same element must not double-wrap.
        service.initialize(el, undefined, undefined, undefined);
        expect(first.dispose).toHaveBeenCalledTimes(1);
    });

    it('dispose() never throws when fabric disposal races the DOM teardown', () => {
        const service = new CanvasOperationsService();
        const el = mountCanvasElement();

        service.initialize(el, undefined, undefined, undefined);
        const canvas = (service as unknown as { canvas: { dispose: ReturnType<typeof vi.fn> } }).canvas;
        canvas.dispose.mockImplementationOnce(() => {
            throw new Error("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.");
        });

        expect(() => service.dispose()).not.toThrow();
        expect(logger.warn).toHaveBeenCalled();
        // The instance is cleared regardless — no stale canvas reference.
        expect((service as unknown as { canvas: unknown }).canvas).toBeNull();
    });

    it('serializes the durable source instead of an editor-only blob URL', async () => {
        const service = new CanvasOperationsService();
        service.initialize(mountCanvasElement());
        const internals = service as unknown as {
            canvas: { toObject: ReturnType<typeof vi.fn> };
            _persistentImageSources: Map<string, string>;
        };
        const durableSource = 'https://example.invalid/artwork.png';
        internals._persistentImageSources.set('blob:editor-only', durableSource);
        internals.canvas.toObject.mockReturnValue({ objects: [
            { type: 'image', src: 'blob:editor-only', data: { isBaseImage: true } },
            { type: 'group', objects: [{ type: 'image', src: 'blob:editor-only' }] },
        ] });
        expect(await service.toJSON()).toEqual({ width: 400, height: 600, objects: [
            { type: 'image', src: durableSource, data: { isBaseImage: true } },
            { type: 'group', objects: [{ type: 'image', src: durableSource }] },
        ] });
        expect(internals.canvas.toObject).toHaveBeenCalledWith(['data', 'id']);
    });

    it('is idempotent: calling dispose twice is a no-op', () => {
        const service = new CanvasOperationsService();
        const el = mountCanvasElement();

        service.initialize(el, undefined, undefined, undefined);
        const canvas = (service as unknown as { canvas: { dispose: ReturnType<typeof vi.fn> } }).canvas;
        service.dispose();
        service.dispose();
        expect(canvas.dispose).toHaveBeenCalledTimes(1);
    });
});
