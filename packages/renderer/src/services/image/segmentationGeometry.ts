/** Map a normalized contour to image pixels, rejecting unusable geometry. */
export function segmentationContour(points: unknown, width: number, height: number): Array<{ x: number; y: number }> {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error('The selection image has invalid dimensions.');
    }
    if (!Array.isArray(points) || points.length < 3 || points.length > 4096) {
        throw new Error('Object analysis did not return a usable selection contour.');
    }
    const normalized = points.map(point => {
        if (!Array.isArray(point) || point.length !== 2 || point.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000)) {
            throw new Error('Object analysis returned selection coordinates outside the image.');
        }
        return { x: point[0] as number, y: point[1] as number };
    });
    const area = normalized.reduce((sum, point, index) => {
        const next = normalized[(index + 1) % normalized.length]!;
        return sum + point.x * next.y - next.x * point.y;
    }, 0);
    if (Math.abs(area) < 1) throw new Error('Object analysis returned an empty selection contour.');
    return normalized.map(point => ({ x: point.x * width / 1000, y: point.y * height / 1000 }));
}

/** Convert the documented [ymin, xmin, ymax, xmax] box into canvas fields. */
export function detectionBox(coordinates: unknown): { ymin: number; xmin: number; ymax: number; xmax: number } {
    if (!Array.isArray(coordinates) || coordinates.length !== 4 || coordinates.some(value => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000)) {
        throw new Error('Object analysis returned an invalid bounding box.');
    }
    const [ymin, xmin, ymax, xmax] = coordinates as [number, number, number, number];
    if (ymax <= ymin || xmax <= xmin) throw new Error('Object analysis returned an empty bounding box.');
    return { ymin, xmin, ymax, xmax };
}
