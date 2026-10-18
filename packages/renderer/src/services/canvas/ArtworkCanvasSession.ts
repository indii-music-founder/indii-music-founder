import { Canvas, FabricImage, type FabricObject } from 'fabric';
import type { BaseLayer, CanvasDoc, CanvasLayer } from './CanvasDoc';
import { artworkTransform } from './ArtworkGeometry';

/** Serialize Fabric's asynchronous disposal, including React Strict Mode remounts. */
export class ArtworkCanvasSession {
    private canvas: Canvas | null = null;
    private disposal: Promise<void> = Promise.resolve();
    private generation = 0;

    async open(element: HTMLCanvasElement): Promise<Canvas | null> {
        const previous = this.close();
        const generation = this.generation;
        await previous;
        if (generation !== this.generation) return null;
        this.canvas = new Canvas(element, { width: 1080, height: 1080, preserveObjectStacking: true, selection: false });
        return this.canvas;
    }
    close(): Promise<void> {
        this.generation++;
        const previous = this.canvas;
        this.canvas = null;
        if (previous) this.disposal = Promise.resolve(previous.dispose()).then(() => undefined);
        return this.disposal;
    }
}

export type ArtworkCanvasObject = FabricImage & { layerId: string; rasterDensity: number };

export function createArtworkCanvasObject(source: HTMLCanvasElement, layer: CanvasLayer, document: CanvasDoc, proxyScale: number, density = 1, selectable = true): ArtworkCanvasObject {
    const t = artworkTransform(layer, source.width / density, source.height / density, document);
    const image = new FabricImage(source) as ArtworkCanvasObject;
    image.layerId = layer.id; image.rasterDensity = density;
    image.set({
        originX: t.scaleX < 0 ? 'right' : 'left', originY: t.scaleY < 0 ? 'bottom' : 'top',
        left: t.x * proxyScale, top: t.y * proxyScale,
        scaleX: Math.abs(t.scaleX) * proxyScale / density, scaleY: Math.abs(t.scaleY) * proxyScale / density,
        flipX: t.scaleX < 0, flipY: t.scaleY < 0, angle: t.rotation,
        opacity: layer.opacity, visible: layer.visible, selectable,
        lockMovementX: layer.locked, lockMovementY: layer.locked,
        lockScalingX: layer.locked, lockScalingY: layer.locked, lockRotation: layer.locked,
        globalCompositeOperation: document.renderVersion === 1 || layer.blendMode === 'normal' ? 'source-over' : layer.blendMode,
    });
    return image;
}

export function readArtworkCanvasTransform(target: FabricObject & { rasterDensity?: number }, proxyScale: number): Pick<BaseLayer, 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'transformAnchor'> {
    const origin = target.getPointByOrigin(target.flipX ? 'right' : 'left', target.flipY ? 'bottom' : 'top');
    const density = target.rasterDensity ?? 1;
    return {
        transformAnchor: 'top-left', x: origin.x / proxyScale, y: origin.y / proxyScale,
        scaleX: target.scaleX * (target.flipX ? -1 : 1) / proxyScale * density,
        scaleY: target.scaleY * (target.flipY ? -1 : 1) / proxyScale * density,
        rotation: target.angle,
    };
}
