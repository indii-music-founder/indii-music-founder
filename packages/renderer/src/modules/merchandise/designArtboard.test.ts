import { describe, expect, it } from 'vitest';
import { readDesignArtboard } from './designArtboard';

describe('saved merchandise artboards', () => {
    it('preserves the dimensions of legacy designs without metadata', () => {
        expect(readDesignArtboard(undefined)).toEqual({ width: 800, height: 1000 });
    });

    it('retains portrait, square and vertical template aspect ratios', () => {
        for (const size of [{ width: 1800, height: 2700 }, { width: 3000, height: 3000 }, { width: 1080, height: 1920 }]) {
            expect(readDesignArtboard(JSON.parse(JSON.stringify(size)))).toEqual(size);
        }
    });

    it('rejects invalid persisted sizes before they can reach canvas allocation', () => {
        for (const value of [null, {}, { width: -1, height: 1000 }, { width: Infinity, height: 1000 }, { width: 800, height: 0 }]) {
            expect(readDesignArtboard(value)).toEqual({ width: 800, height: 1000 });
        }
    });
});
