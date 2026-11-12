import type { Canvas } from 'fabric';

export interface DesignArtboard {
    width: number;
    height: number;
}

export const DEFAULT_ARTBOARD: DesignArtboard = { width: 800, height: 1000 };
const artboards = new WeakMap<Canvas, DesignArtboard>();

// Designs saved before artboard metadata used the original 800 × 1000 canvas.
export function readDesignArtboard(value: unknown): DesignArtboard {
    const candidate = value as Partial<DesignArtboard> | null;
    if (!candidate || !Number.isFinite(candidate.width) || !Number.isFinite(candidate.height)
        || Number(candidate.width) <= 0 || Number(candidate.height) <= 0) {
        return { ...DEFAULT_ARTBOARD };
    }
    return { width: Number(candidate.width), height: Number(candidate.height) };
}

export function getDesignArtboard(canvas: Canvas): DesignArtboard {
    return artboards.get(canvas) ?? DEFAULT_ARTBOARD;
}

export function setDesignArtboard(canvas: Canvas, value: unknown): void {
    const artboard = readDesignArtboard(value);
    const scale = Math.min(canvas.getWidth() / artboard.width, canvas.getHeight() / artboard.height);
    artboards.set(canvas, artboard);
    canvas.setViewportTransform([scale, 0, 0, scale, 0, 0]);
    canvas.setDimensions({ width: artboard.width * scale, height: artboard.height * scale });
    canvas.requestRenderAll();
}

export function serializeDesignCanvas(canvas: Canvas, properties: string[]): Record<string, unknown> {
    return { ...canvas.toObject(properties), artboard: getDesignArtboard(canvas) };
}

export async function restoreDesignCanvas(canvas: Canvas, data: Record<string, unknown>): Promise<void> {
    await canvas.loadFromJSON(data);
    setDesignArtboard(canvas, data.artboard);
}

export function renderDesignCanvas(canvas: Canvas, format: 'png' | 'jpeg' | 'svg'): string {
    const artboard = getDesignArtboard(canvas);
    const viewport = [...canvas.viewportTransform];
    const width = canvas.width;
    const height = canvas.height;
    try {
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.setDimensions(artboard);
        if (format === 'svg') return canvas.toSVG();
        return canvas.toDataURL({ format, quality: format === 'jpeg' ? 0.9 : 1, multiplier: 2 });
    } finally {
        canvas.setViewportTransform(viewport as [number, number, number, number, number, number]);
        canvas.setDimensions({ width, height });
        canvas.requestRenderAll();
    }
}
