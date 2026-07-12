import { describe, it, expect } from 'vitest';
import { isRemoteSurfaceDevice, isStudioExecutorSurface } from './App';

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

describe('isStudioExecutorSurface (ISSUE-1025)', () => {
    it('never lets a phone or tablet Controller publish Studio presence', () => {
        expect(isStudioExecutorSurface('dashboard', true)).toBe(false);
    });

    it('also excludes a desktop-sized Controller route', () => {
        expect(isStudioExecutorSurface('mobile-remote', false)).toBe(false);
    });

    it('allows the actual desktop Studio surface to own the relay', () => {
        expect(isStudioExecutorSurface('dashboard', false)).toBe(true);
    });
});
