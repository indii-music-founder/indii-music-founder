import { describe, it, expect } from 'vitest';
import { isRemoteSurfaceDevice } from './App';

describe('isRemoteSurfaceDevice', () => {
    it('routes phones to the remote surface', () => {
        expect(
            isRemoteSurfaceDevice({
                isAnyPhone: true,
                isTablet: false,
                isTouchDevice: true,
            })
        ).toBe(true);
    });

    it('routes touch-capable tablets like iPad to the remote surface', () => {
        expect(
            isRemoteSurfaceDevice({
                isAnyPhone: false,
                isTablet: true,
                isTouchDevice: true,
            })
        ).toBe(true);
    });

    it('keeps non-touch tablet-sized desktop windows on the studio surface', () => {
        expect(
            isRemoteSurfaceDevice({
                isAnyPhone: false,
                isTablet: true,
                isTouchDevice: false,
            })
        ).toBe(false);
    });

    it('keeps desktop on the studio surface', () => {
        expect(
            isRemoteSurfaceDevice({
                isAnyPhone: false,
                isTablet: false,
                isTouchDevice: false,
            })
        ).toBe(false);
    });
});
