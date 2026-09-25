/**
 * ScreenControlService pop-out fallback (ISSUE-1433 follow-up unit).
 *
 * Chromium with the Window Management API → 'projector' placement.
 * Every other browser → 'popup' fallback (same-origin, BroadcastChannel sync).
 * A suppressed popup must read as 'blocked', never as success.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScreenControl } from './ScreenControlService';

const ORIGIN = 'https://indii.music';

describe('openProjectorWindow fallback', () => {
    const open = vi.fn(
        (_url: string, _target: string, _features?: string): Window => ({ terminated: false }) as unknown as Window,
    );

    beforeEach(() => {
        vi.stubGlobal('window', {
            location: { origin: ORIGIN },
            screen: { width: 1920, height: 1080 },
            open,
        });
        open.mockClear();
        open.mockImplementation(
            (_url: string, _target: string, _features?: string): Window => ({ terminated: false }) as unknown as Window,
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('falls back to a centered popup when the Window Management API is missing', () => {
        const mode = ScreenControl.openProjectorWindow('/video-popout', 1);

        expect(mode).toBe('popup');
        expect(open).toHaveBeenCalledTimes(1);
        const [url, , features] = open.mock.calls[0]!;
        expect(url).toBe(`${ORIGIN}/video-popout`);
        expect(features).toContain('noopener,noreferrer');
        expect(features).toContain('resizable=yes');
    });

    it('places on the chosen screen when screen details are granted', async () => {
        vi.stubGlobal('window', {
            location: { origin: ORIGIN },
            screen: { width: 1920, height: 1080 },
            open,
            getScreenDetails: async () => ({
                screens: [
                    { left: 0, top: 0, width: 1920, height: 1080, isPrimary: true, isInternal: true, devicePixelRatio: 2, label: 'Built-in', availLeft: 0, availTop: 0 },
                    { left: 1920, top: 0, width: 3840, height: 2160, isPrimary: false, isInternal: false, devicePixelRatio: 1, label: 'Projector', availLeft: 1920, availTop: 0 },
                ],
                currentScreen: {},
                oncurrentscreenchange: null,
                onscreenschange: null,
            }),
        });

        await ScreenControl.requestPermission();
        const mode = ScreenControl.openProjectorWindow('/video-popout', 1);

        expect(mode).toBe('projector');
        expect(open).toHaveBeenCalledTimes(1);
        const features = open.mock.calls[0]![2]!;
        // Second screen geometry: 1920x2160 at left=1920.
        expect(features).toContain('left=1920');
        expect(features).toContain('width=3840');
        expect(features).toContain('height=2160');
    });

    it('falls back to a popup when a granted session has no usable screens', () => {
        const service = ScreenControl as unknown as { screenDetails: unknown };
        service.screenDetails = { screens: [] };

        const mode = ScreenControl.openProjectorWindow('/video-popout', 1);

        expect(mode).toBe('popup');
        expect(open).toHaveBeenCalledTimes(1);
    });

    it('reports blocked when the popup is suppressed', () => {
        open.mockReturnValue(null);

        const mode = ScreenControl.openProjectorWindow('/video-popout', 1);

        expect(mode).toBe('blocked');
    });

    it('reports blocked for non-HTTP content URLs', () => {
        const mode = ScreenControl.openProjectorWindow('javascript:alert(1)', 1);

        expect(mode).toBe('blocked');
        expect(open).not.toHaveBeenCalled();
    });
});
