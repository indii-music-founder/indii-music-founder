import type { FabricObject } from 'fabric';
import { describe, expect, it, vi } from 'vitest';
import { commitLayerProperty } from './commitLayerProperty';

describe('commitLayerProperty', () => {
    it('keeps a pre-edit checkpoint and notifies canvas listeners about the edit', () => {
        let fontSize = 60;
        const target = {
            get: () => fontSize,
            set: (properties: { fontSize: number }) => { fontSize = properties.fontSize; },
            setCoords: vi.fn(),
        } as unknown as FabricObject;
        const captured: number[] = [];
        const saveState = () => { captured.push(fontSize); };
        const canvas = {
            getObjects: () => [target],
            fire: vi.fn(),
            requestRenderAll: vi.fn(),
        };
        commitLayerProperty(canvas, target, 'fontSize', 48, saveState);
        commitLayerProperty(canvas, target, 'fontSize', 48, saveState);

        expect(captured).toEqual([60, 48]);
        expect(target.setCoords).toHaveBeenCalledOnce();
        expect(canvas.fire).toHaveBeenCalledExactlyOnceWith('object:modified', { target });
        expect(canvas.requestRenderAll).toHaveBeenCalledOnce();
    });
});
