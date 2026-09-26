import { describe, expect, it } from 'vitest';
import { INTELLIGENCE_CONFIG } from '../intelligence-models';
import { NANO_BANANA_CAPABILITIES } from '@indii/shared';

/**
 * ISSUE-320 — capability-sync guard.
 *
 * The canonical image-model capability registry lives in @indii/shared.
 * INTELLIGENCE_CONFIG in this package mirrors it for client-side generation
 * defaults. These tests fail CI if the two surfaces drift apart again (the
 * stale "Flash supports up to 1K" declaration silently downgraded every
 * fast-tier generation — the mechanism behind issue #319).
 */
describe('INTELLIGENCE_CONFIG ↔ NANO_BANANA_CAPABILITIES sync (ISSUE-320)', () => {
    const RESOLUTION_TO_PIXELS: Record<string, number> = {
        '512': 512,
        '1K': 1024,
        '2K': 2048,
        '4K': 4096,
    };

    it('FAST tier imageSize matches the Flash model max resolution in the canonical registry', () => {
        const flash = NANO_BANANA_CAPABILITIES['gemini-3.1-flash-image'];
        expect(INTELLIGENCE_CONFIG.IMAGE.FAST.imageConfig.imageSize).toBe(flash.maxResolution);
    });

    it('DEFAULT tier imageSize matches the Pro model max resolution in the canonical registry', () => {
        const pro = NANO_BANANA_CAPABILITIES['gemini-3-pro-image'];
        expect(INTELLIGENCE_CONFIG.IMAGE.DEFAULT.imageConfig.imageSize).toBe(pro.maxResolution);
    });

    it('no generation route is declared below full model capability', () => {
        // Every declared imageSize must reach at least the highest resolution the
        // registry grants any current model — no silent downgrades.
        const bestCapability = Math.max(
            ...Object.values(NANO_BANANA_CAPABILITIES).map(c => RESOLUTION_TO_PIXELS[c.maxResolution]),
        );
        for (const route of [INTELLIGENCE_CONFIG.IMAGE.DEFAULT, INTELLIGENCE_CONFIG.IMAGE.FAST]) {
            const pixels = RESOLUTION_TO_PIXELS[route.imageConfig.imageSize];
            expect(pixels).toBeDefined();
            expect(pixels).toBe(bestCapability);
        }
    });
});
