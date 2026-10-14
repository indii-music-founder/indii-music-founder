import { describe, expect, it } from 'vitest';
import { segmentationContour, detectionBox } from './segmentationGeometry';

// Pure geometry checks: no account, media history, or provider responses are simulated.
describe('segmentation contour geometry', () => {
    it('maps x and y independently for a portrait image', () => {
        expect(segmentationContour([[100, 200], [900, 200], [500, 800]], 600, 800)).toEqual([
            { x: 60, y: 160 }, { x: 540, y: 160 }, { x: 300, y: 640 },
        ]);
    });
    it('accepts a closed contour without changing its placement', () => {
        expect(segmentationContour([[0, 0], [1000, 0], [1000, 1000], [0, 0]], 400, 200)[2]).toEqual({ x: 400, y: 200 });
    });
    it.each([
        [], [[0, 0], [1000, 1000]], [[0, 0], [500, 500], [1000, 1000]],
        [[0, 0], [1001, 0], [500, 1000]], [[0, 0], [-1, 0], [500, 1000]],
        [[0, 0], [NaN, 0], [500, 1000]], [[0, 0], ['100', 0], [500, 1000]],
    ].map(points => ({ points })))('rejects an invalid contour $points', ({ points }) => {
        expect(() => segmentationContour(points, 600, 800)).toThrow();
    });
    it('rejects an image without dimensions', () => {
        expect(() => segmentationContour([[0, 0], [1000, 0], [1000, 1000]], 0, 800)).toThrow();
    });
});

describe('normalized detection boxes', () => {
    it('preserves the documented y,x order', () => {
        expect(detectionBox([100, 200, 700, 900])).toEqual({ ymin: 100, xmin: 200, ymax: 700, xmax: 900 });
    });
    it.each([[100, 200, 100, 900], [100, 900, 700, 200], [-1, 200, 700, 900], [100, 200, 700], [100, 200, 1001, 900]].map(coordinates => ({ coordinates })))('rejects invalid bounds $coordinates', ({ coordinates }) => {
        expect(() => detectionBox(coordinates)).toThrow();
    });
});
