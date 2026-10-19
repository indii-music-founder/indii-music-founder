import { NEUTRAL_ADJUSTMENTS, type CanvasDoc, type CanvasLayer, type AdjustmentStack } from './CanvasDoc';

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid artwork document');
    return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Artwork ${label} is missing`);
    return value;
}
function asset(value: unknown, label: string): string {
    const source = text(value, label);
    if (/^(javascript|file|blob):/i.test(source)) throw new Error(`Artwork ${label} is not persistent`);
    return source;
}
function number(value: unknown, label: string, minimum = -Infinity, maximum = Infinity): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
        throw new Error(`Invalid artwork ${label}`);
    }
    return value;
}
function flag(value: unknown, fallback: boolean): boolean {
    if (value === undefined) return fallback;
    if (typeof value !== 'boolean') throw new Error('Invalid artwork layer flag');
    return value;
}

/** Validate data at the persistence boundary; retain legacy adjustment semantics. */
export function normalizeCanvasDoc(value: unknown, expectedId?: string): CanvasDoc {
    const raw = record(value);
    const id = text(raw.id, 'ID');
    if (id.includes('/') || (expectedId && id !== expectedId)) throw new Error('Artwork ID does not match its saved location');
    if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1 && raw.schemaVersion !== 2) {
        throw new Error('This artwork uses an unsupported document version');
    }
    const renderVersion = raw.renderVersion ?? (raw.schemaVersion === 2 ? 2 : 1);
    if (renderVersion !== 1 && renderVersion !== 2) throw new Error('Unsupported artwork rendering version');
    const width = number(raw.width, 'width', 1, 12000);
    const height = number(raw.height, 'height', 1, 12000);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width * height > 36_000_000) {
        throw new Error('Artwork dimensions exceed the supported size');
    }
    if (!Array.isArray(raw.layers) || raw.layers.length > 100) throw new Error('Invalid artwork layers');
    const ids = new Set<string>();
    const layers: CanvasLayer[] = raw.layers.map(value => {
        const layer = record(value);
        const id = text(layer.id, 'layer ID');
        if (ids.has(id)) throw new Error('Artwork contains duplicate layer IDs');
        ids.add(id);
        const blendMode = layer.blendMode ?? 'normal';
        if (!['normal', 'multiply', 'screen', 'overlay', 'soft-light'].includes(String(blendMode))) throw new Error('Unsupported artwork blend mode');
        const base = {
            id, name: text(layer.name ?? 'Layer', 'layer name'),
            x: number(layer.x ?? 0, 'position'), y: number(layer.y ?? 0, 'position'),
            scaleX: number(layer.scaleX ?? 1, 'scale', -100, 100), scaleY: number(layer.scaleY ?? 1, 'scale', -100, 100),
            rotation: number(layer.rotation ?? 0, 'rotation'), opacity: number(layer.opacity ?? 1, 'opacity', 0, 1),
            visible: flag(layer.visible, true), locked: flag(layer.locked, false),
            blendMode: blendMode as CanvasLayer['blendMode'],
            transformAnchor: layer.transformAnchor === 'center' || layer.transformAnchor === 'top-left'
                ? layer.transformAnchor : renderVersion === 1 ? 'center' as const : 'top-left' as const,
        };
        if (!base.scaleX || !base.scaleY) throw new Error('Artwork layer scale cannot be zero');
        if (layer.kind === 'raster') {
            const source = asset(layer.src, 'photo source');
            const input = record(layer.adjustments ?? {});
            const adjustments = { ...NEUTRAL_ADJUSTMENTS };
            for (const key of Object.keys(adjustments) as (keyof AdjustmentStack)[]) {
                const range = key === 'hue' ? 180 : key === 'exposure' && layer.adjustmentVersion === 2 ? 2 : 1;
                adjustments[key] = number(input[key] ?? 0, key, key === 'blur' || key === 'vignette' ? 0 : -range, range);
            }
            if (layer.adjustmentVersion !== undefined && ![1, 2].includes(Number(layer.adjustmentVersion))) throw new Error('Unsupported adjustment version');
            const result: CanvasLayer = {
                ...base, kind: 'raster', src: source, adjustments,
                adjustmentVersion: layer.adjustmentVersion === 2 ? 2 : 1,
                subjectIsolated: flag(layer.subjectIsolated, false),
            };
            if (layer.originalSrc !== undefined) result.originalSrc = asset(layer.originalSrc, 'original photo source');
            if (layer.framing === 'fit' || layer.framing === 'fill') result.framing = layer.framing;
            if (layer.maskSrc !== undefined) result.maskSrc = asset(layer.maskSrc, 'mask source');
            if (layer.maskFeather !== undefined) result.maskFeather = number(layer.maskFeather, 'edge softness', 0, 8);
            if (layer.look !== undefined) {
                const look = record(layer.look);
                if (!['original', 'warm-film', 'cool-night', 'mono'].includes(String(look.id)) || look.version !== 1) throw new Error('Unsupported artwork look');
                result.look = { id: look.id as NonNullable<typeof result.look>['id'], strength: number(look.strength, 'look strength', 0, 1), version: 1 };
            }
            if (layer.grain !== undefined) {
                const grain = record(layer.grain);
                result.grain = { amount: number(grain.amount, 'grain', 0, 1), seed: number(grain.seed, 'grain seed', 0, 0xffffffff) };
            }
            return result;
        }
        if (layer.kind !== 'text') throw new Error('Unsupported artwork layer');
        const t = record(layer.typography);
        return {
            ...base, kind: 'text', rasterScale: number(layer.rasterScale ?? (renderVersion === 1 ? Math.min(1, 1024 / Math.max(width, height)) : 1), 'text rendering scale', 0.01, 1), typography: {
                id, kind: 'text', text: typeof t.text === 'string' ? t.text : text(t.text, 'text'),
                fontId: text(t.fontId, 'font'), fontSize: number(t.fontSize, 'font size', 1, 12000),
                letterSpacing: number(t.letterSpacing ?? 0, 'letter spacing', -1000, 1000), kerning: flag(t.kerning, true),
                fill: text(t.fill, 'text color'), x: base.x, y: base.y, rotation: base.rotation, opacity: base.opacity, visible: base.visible,
                ...(t.stroke ? { stroke: { color: text(record(t.stroke).color, 'stroke color'), width: number(record(t.stroke).width, 'stroke width', 0, 1000) } } : {}),
            },
        };
    });
    return {
        id, projectId: text(raw.projectId, 'project'), width, height,
        background: text(raw.background, 'background'), layers,
        updatedAt: number(raw.updatedAt ?? 0, 'timestamp', 0),
        schemaVersion: 2, renderVersion, revision: number(raw.revision ?? 0, 'revision', 0),
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 200) : 'Untitled cover',
    };
}

/** Optional data is a domain boundary, not a simulated persistence service. */
export function readCanvasDocument(value: unknown | null, expectedId: string): CanvasDoc | null {
    return value === null ? null : normalizeCanvasDoc(value, expectedId);
}

export interface SavedArtworkSummary {
    id: string;
    projectId: string;
    name: string;
    updatedAt: number;
    revision: number;
    renderVersion: 1 | 2;
    unsupportedVersion: boolean;
}

/** Listing metadata remains readable even when a particular document needs a newer editor. */
export function summarizeArtwork(id: string, projectId: string, value: unknown): SavedArtworkSummary {
    const data = record(value);
    return {
        id, projectId,
        name: typeof data.name === 'string' && data.name.trim() ? data.name.slice(0, 200) : 'Untitled cover',
        updatedAt: typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt) ? data.updatedAt : 0,
        revision: typeof data.revision === 'number' && Number.isFinite(data.revision) ? data.revision : 0,
        renderVersion: data.renderVersion === 1 || data.schemaVersion === undefined || data.schemaVersion === 1 ? 1 : 2,
        unsupportedVersion: data.schemaVersion !== undefined && data.schemaVersion !== 1 && data.schemaVersion !== 2,
    };
}
export function newestArtworkFirst<T extends { updatedAt: number }>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}
