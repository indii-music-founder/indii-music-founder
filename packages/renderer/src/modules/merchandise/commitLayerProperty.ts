import type { Canvas, FabricObject } from 'fabric';
import type { LayerPropertyValue } from './types/fabric-extensions';

export function commitLayerProperty(
    canvas: Pick<Canvas, 'getObjects' | 'fire' | 'requestRenderAll'> | null,
    target: FabricObject,
    property: string,
    value: LayerPropertyValue,
    saveState: () => void,
) {
    if (!canvas?.getObjects().includes(target) || target.get(property as keyof FabricObject) === value) return;

    // Preserve the previous state even if a just-added layer has not reached the debounced history save.
    saveState();
    target.set({ [property]: value });
    target.setCoords();
    canvas.fire('object:modified', { target });
    canvas.requestRenderAll();
    saveState();
}
