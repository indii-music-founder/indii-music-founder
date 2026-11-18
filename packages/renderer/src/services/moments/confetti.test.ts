import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { burstConfetti, CONFETTI_COLORS } from './confetti';

describe('burstConfetti', () => {
    const originalMatchMedia = window.matchMedia;
    const originalRaf = window.requestAnimationFrame;
    const originalCancelRaf = window.cancelAnimationFrame;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
        window.requestAnimationFrame = originalRaf;
        window.cancelAnimationFrame = originalCancelRaf;
    });

    it('uses Frequency palette colors including amber gold', () => {
        expect(CONFETTI_COLORS).toEqual([
            '#2E2EFE',
            '#FE2E9A',
            '#FF0099',
            '#00F0FF',
            '#FFB800',
        ]);
    });

    it('is an immediate no-op when prefers-reduced-motion is reduce', () => {
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const rafSpy = vi.fn();
        window.requestAnimationFrame = rafSpy;

        const canvas = document.createElement('canvas');
        const stop = burstConfetti(canvas);

        expect(typeof stop).toBe('function');
        expect(rafSpy).not.toHaveBeenCalled();
        expect(() => stop()).not.toThrow();
    });

    it('runs a single requestAnimationFrame loop and auto-stops after durationMs', () => {
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        let nextCallback: FrameRequestCallback | null = null;
        const rafSpy = vi.fn((cb: FrameRequestCallback) => {
            nextCallback = cb;
            return 42;
        });
        const cancelSpy = vi.fn();
        window.requestAnimationFrame = rafSpy;
        window.cancelAnimationFrame = cancelSpy;

        const canvas = document.createElement('canvas');
        const stop = burstConfetti(canvas, { durationMs: 2200, particleCount: 12 });

        expect(rafSpy).toHaveBeenCalledTimes(1);
        expect(nextCallback).not.toBeNull();

        // Advance within duration: schedules next frame
        nextCallback!(1000);
        expect(rafSpy).toHaveBeenCalledTimes(2);

        // Advance past duration (1000 + 2250): auto-stops without scheduling another frame
        nextCallback!(3250);
        expect(rafSpy).toHaveBeenCalledTimes(2);

        stop();
    });

    it('cancels animation frame when returned cleanup is invoked early', () => {
        window.matchMedia = vi.fn().mockImplementation(() => ({
            matches: false,
            media: '',
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        window.requestAnimationFrame = vi.fn(() => 99);
        const cancelSpy = vi.fn();
        window.cancelAnimationFrame = cancelSpy;

        const canvas = document.createElement('canvas');
        const stop = burstConfetti(canvas);
        stop();

        expect(cancelSpy).toHaveBeenCalledWith(99);
    });
});
