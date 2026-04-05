import * as fabric from 'fabric';

/**
 * Convert hex color to rgba string
 * @param hex - Hex color string (e.g., '#ff0000')
 * @param alpha - Alpha value 0-1 (default: 1)
 * @returns rgba string (e.g., 'rgba(255, 0, 0, 0.5)')
 */
export function hexToRgba(hex: string, alpha = 1): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Scale and center an image to fit within a canvas with padding
 * @param img - Fabric.js Image object
 * @param canvas - Fabric.js Canvas object
 * @param padding - Padding in pixels (default: 40)
 */
export function scaleImageToCanvas(
    img: fabric.Image,
    canvas: fabric.Canvas,
    padding = 40
): void {
    const scale = Math.min(
        (canvas.width! - padding) / img.width!,
        (canvas.height! - padding) / img.height!
    );
    img.scale(scale);
    img.set({
        left: canvas.width! / 2,
        top: canvas.height! / 2,
        originX: 'center',
        originY: 'center',
        selectable: false
    });
}
