import { describe, it, expect } from 'vitest';
import {
    blendModeToPsd,
    canvasDocToPsd,
    readPsd,
    type RenderedRaster,
} from '../PsdExportService';
import { createDocFromImage, type CanvasDoc, type RasterLayer } from '../CanvasDoc';

function solidRaster(width: number, height: number, channel: number): RenderedRaster {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
        data[i * 4] = channel;
        data[i * 4 + 1] = channel;
        data[i * 4 + 2] = channel;
        data[i * 4 + 3] = 255;
    }
    return { width, height, data };
}

function makeTwoRasterLayerDoc(): CanvasDoc {
    const doc = createDocFromImage('data:image/png;base64,AAA', 'proj_1');
    doc.width = 16;
    doc.height = 16;
    const background = doc.layers[0] as RasterLayer;
    const foreground: RasterLayer = {
        ...background,
        id: 'layer_foreground',
        name: 'Foreground',
        opacity: 0.6,
        blendMode: 'soft-light',
        visible: false,
    };
    doc.layers.push(foreground);
    return doc;
}

describe('blendModeToPsd (C3)', () => {
    it('maps CanvasBlendMode to Photoshop blend names', () => {
        expect(blendModeToPsd('normal')).toBe('normal');
        expect(blendModeToPsd('multiply')).toBe('multiply');
        expect(blendModeToPsd('screen')).toBe('screen');
        expect(blendModeToPsd('overlay')).toBe('overlay');
        expect(blendModeToPsd('soft-light')).toBe('soft light');
    });
});

describe('canvasDocToPsd (C3.1/C3.2)', () => {
    it('writes a PSD whose dimensions, layers, and metadata round-trip', async () => {
        const doc = makeTwoRasterLayerDoc();
        const buffer = await canvasDocToPsd(doc, {
            scale: 1,
            renderRaster: async (layer) => {
                // background is 16x16, foreground is 8x8 — distinct sizes to
                // prove per-layer geometry is preserved.
                return layer.id === 'layer_foreground'
                    ? solidRaster(8, 8, 200)
                    : solidRaster(16, 16, 50);
            },
        });

        const psd = readPsd(buffer, { skipLayerImageData: true, skipCompositeImageData: true });

        expect(psd.width).toBe(16);
        expect(psd.height).toBe(16);
        expect(psd.children).toHaveLength(2);

        // children are top-to-bottom, so the Foreground (topmost) is first.
        const [top, bottom] = psd.children!;
        expect(top!.name).toBe('Foreground');
        expect(bottom!.name).toBe('Background');

        expect(top!.opacity).toBeCloseTo(0.6);
        expect(top!.hidden).toBe(true);
        expect(top!.blendMode).toBe('soft light');
        expect(bottom!.opacity).toBeCloseTo(1);
        expect(bottom!.hidden).toBe(false);
        expect(bottom!.blendMode).toBe('normal');
    });

    it('applies the export scale to document dimensions', async () => {
        const doc = createDocFromImage('data:image/png;base64,AAA', 'proj_1');
        doc.width = 10;
        doc.height = 20;
        const buffer = await canvasDocToPsd(doc, {
            scale: 2,
            renderRaster: async () => solidRaster(1, 1, 128),
        });

        const psd = readPsd(buffer, { skipLayerImageData: true, skipCompositeImageData: true });
        expect(psd.width).toBe(20);
        expect(psd.height).toBe(40);
    });
});
