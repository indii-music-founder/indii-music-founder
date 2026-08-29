/**
 * CanvasDoc.ts
 *
 * Non-destructive canvas document model (Workstream C1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §8).
 *
 * DEC-4: all adjustment parameters live ONLY on the document. Fabric filters
 * are rebuilt from these params on every change; the source raster element is
 * never mutated. Temperature maps to a warm/cool BlendColor tint (not hue) to
 * avoid skin-tone shifts.
 */

export type CanvasBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';

export interface AdjustmentStack {
    /** -1..1 */
    brightness: number;
    /** -1..1 */
    contrast: number;
    /** -1..1 */
    saturation: number;
    /** -180..180 (deg) */
    hue: number;
    /** -1..1 (cool↔warm via BlendColor) */
    temperature: number;
    /** -1..1 */
    exposure: number;
    /** 0..1 */
    blur: number;
    /** 0..1 */
    vignette: number;
}

export const NEUTRAL_ADJUSTMENTS: AdjustmentStack = {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    temperature: 0,
    exposure: 0,
    blur: 0,
    vignette: 0
};

export interface BaseLayer {
    id: string;
    name: string;
    visible: boolean;
    locked: boolean;
    opacity: number;
    blendMode: CanvasBlendMode;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
}

export interface RasterLayer extends BaseLayer {
    kind: 'raster';
    src: string;
    adjustments: AdjustmentStack;
    subjectIsolated?: boolean;
}

export interface TypographyLayer {
    id: string;
    kind: 'text';
    fontId: string;
    text: string;
    fontSize: number;
    letterSpacing: number;
    kerning: boolean;
    fill: string;
    stroke?: { color: string; width: number };
    x: number;
    y: number;
    rotation: number;
    opacity: number;
    visible: boolean;
    vector?: { svgPathD: string; width: number; height: number; advanceWidth: number; baselineY: number; glyphCount: number };
}

export interface TextLayer extends BaseLayer {
    kind: 'text';
    typography: TypographyLayer;
}

export type CanvasLayer = RasterLayer | TextLayer;

export interface CanvasDoc {
    id: string;
    projectId: string;
    width: number;
    height: number;
    background: string;
    layers: CanvasLayer[];
    updatedAt: number;
}

export function createDocFromImage(src: string, projectId: string): CanvasDoc {
    if (!src) throw new Error('createDocFromImage: src is required');
    if (!projectId) throw new Error('createDocFromImage: projectId is required');

    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const layer: RasterLayer = {
        id: `layer_${Date.now()}`,
        name: 'Background',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        kind: 'raster',
        src,
        adjustments: { ...NEUTRAL_ADJUSTMENTS },
        subjectIsolated: false
    };

    return {
        id,
        projectId,
        width: 1080,
        height: 1080,
        background: '#000000',
        layers: [layer],
        updatedAt: Date.now()
    };
}

/** Merge an adjustment patch, returning a NEW stack (immutability). */
export function mergeAdjustments(base: AdjustmentStack, patch: Partial<AdjustmentStack>): AdjustmentStack {
    return { ...base, ...patch };
}

/**
 * Deterministic, ordered mapping of AdjustmentStack → Fabric filter descriptor
 * choices. Each non-neutral field contributes exactly ONE filter instance
 * (C1.2). A neutral stack yields ZERO filters. Temperature is a BlendColor
 * warm/cool tint (not hue).
 */
export interface FabricFilterDescriptor {
    type: 'Brightness' | 'Contrast' | 'Saturation' | 'HueRotation' | 'BlendColor' | 'Gamma' | 'Blur' | 'Convolute';
    args: Record<string, number | string | number[]>;
}

export function adjustmentsToFilters(a: AdjustmentStack): FabricFilterDescriptor[] {
    const filters: FabricFilterDescriptor[] = [];

    if (a.brightness !== 0) {
        // Brightness range -1..1 → Fabric brightness -1..1.
        filters.push({ type: 'Brightness', args: { brightness: a.brightness } });
    }
    if (a.contrast !== 0) {
        // Fabric Contrast is 0..1 with 0 neutral; shift our -1..1 into 0..1.
        filters.push({ type: 'Contrast', args: { contrast: Math.abs(a.contrast) } });
    }
    if (a.saturation !== 0) {
        // Fabric Saturation 0..1 with 0 neutral.
        filters.push({ type: 'Saturation', args: { saturation: Math.abs(a.saturation) } });
    }
    if (a.hue !== 0) {
        // HueRotation degrees.
        filters.push({ type: 'HueRotation', args: { rotation: a.hue } });
    }
    if (a.temperature !== 0) {
        // Warm/cool tint via BlendColor (never hue — avoids skin-tone shifts).
        filters.push({ type: 'BlendColor', args: {
            color: a.temperature > 0 ? '#ff9a4d' : '#4da3ff',
            mode: 'softLight'
        } });
    }
    if (a.exposure !== 0) {
        // Exposure via Gamma on midtones (range -1..1 → gamma 0.5..1.5).
        filters.push({ type: 'Gamma', args: { gamma: 1 + a.exposure * 0.5 } });
    }
    if (a.blur > 0) {
        filters.push({ type: 'Blur', args: { blur: a.blur } });
    }
    if (a.vignette > 0) {
        filters.push({ type: 'Convolute', args: { matrix: vignetteMatrix(a.vignette) } });
    }

    return filters;
}

/**
 * Transform patch from a Fabric `object:modified` event → layer fields.
 * Pure + immutable (C2.2): applying the same transform twice yields the same
 * result (no drift), so the doc stays the single source of truth.
 */
export function applyTransformPatch<
    L extends BaseLayer
>(layer: L, patch: Partial<Pick<BaseLayer, 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation'>>): L {
    return { ...layer, x: patch.x ?? layer.x, y: patch.y ?? layer.y, scaleX: patch.scaleX ?? layer.scaleX, scaleY: patch.scaleY ?? layer.scaleY, rotation: patch.rotation ?? layer.rotation };
}

/** 3x3 Convolute kernel that darkens the frame edges proportionally to strength. */
export function vignetteMatrix(strength: number): number[] {
    const s = Math.max(0, Math.min(1, strength));
    // Center-weighted kernel that pulls toward dark at the borders.
    return [1, 0, 0, 0, 1, 0, 0, 0, 1].map(v => v * (1 - s * 0.5));
}
