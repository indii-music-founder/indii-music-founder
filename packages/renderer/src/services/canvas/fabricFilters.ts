/**
 * fabricFilters.ts
 *
 * Instantiates Fabric 7 filter objects from the deterministic descriptors
 * produced by `adjustmentsToFilters` (DEC-4: adjustment params live ONLY on the
 * CanvasDoc; Fabric filters are rebuilt from params on every change).
 */

import * as fabric from 'fabric';
import type { FabricFilterDescriptor } from './CanvasDoc';

const FILTER_CTORS = {
    Brightness: fabric.filters.Brightness,
    Contrast: fabric.filters.Contrast,
    Saturation: fabric.filters.Saturation,
    HueRotation: fabric.filters.HueRotation,
    BlendColor: fabric.filters.BlendColor,
    Gamma: fabric.filters.Gamma,
    Blur: fabric.filters.Blur,
    Convolute: fabric.filters.Convolute,
} as const;

type FilterCtor = new (props: Record<string, unknown>) => fabric.filters.BaseFilter<string>;

export function descriptorsToFabricFilters(descriptors: FabricFilterDescriptor[]): fabric.filters.BaseFilter<string>[] {
    return descriptors.map((descriptor) => {
        const Ctor = FILTER_CTORS[descriptor.type] as unknown as FilterCtor;
        return new Ctor(descriptor.args as unknown as Record<string, unknown>);
    });
}
