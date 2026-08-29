import { describe, it, expect } from 'vitest';
import { PLATFORM_DIMENSIONS } from '@/services/image/CanvasBatchService';

/**
 * G1.2 — Registry integrity: the founder's required platform matrix exists
 * with exact pixels, and the legacy rows were never touched (plan §12: the
 * registry is the single dimension list — A-7).
 */
describe('PLATFORM_DIMENSIONS registry (G1.2)', () => {
    it('contains Spotify Cover at exactly 3000×3000', () => {
        const d = PLATFORM_DIMENSIONS.find(x => x.id === 'spotify_cover');
        expect(d).toBeDefined();
        expect(d!.width).toBe(3000);
        expect(d!.height).toBe(3000);
    });

    it('contains Stories at exactly 1080×1920', () => {
        const d = PLATFORM_DIMENSIONS.find(x => x.id === 'ig_story');
        expect(d).toBeDefined();
        expect(d!.width).toBe(1080);
        expect(d!.height).toBe(1920);
    });

    it('contains YouTube at 1920×1080 (legacy landscape row) and a 2560×1440 banner', () => {
        const yt = PLATFORM_DIMENSIONS.find(x => x.id === 'landscape');
        expect(yt).toBeDefined();
        expect(yt!.width).toBe(1920);
        expect(yt!.height).toBe(1080);

        const banner = PLATFORM_DIMENSIONS.find(x => x.id === 'yt_banner');
        expect(banner).toBeDefined();
        expect(banner!.width).toBe(2560);
        expect(banner!.height).toBe(1440);
    });

    it('contains X rows (1600×900 post, 400×400 profile) and Facebook OG 1200×630', () => {
        const xPost = PLATFORM_DIMENSIONS.find(x => x.id === 'x_post');
        expect(xPost).toMatchObject({ width: 1600, height: 900 });
        const xProfile = PLATFORM_DIMENSIONS.find(x => x.id === 'x_profile');
        expect(xProfile).toMatchObject({ width: 400, height: 400 });
        const og = PLATFORM_DIMENSIONS.find(x => x.id === 'facebook_og');
        expect(og).toMatchObject({ width: 1200, height: 630 });
    });

    it('keeps all legacy rows untouched', () => {
        const legacy: Array<[string, number, number]> = [
            ['portrait', 1080, 1920],
            ['square', 1080, 1080],
            ['landscape', 1920, 1080],
            ['story', 720, 1280]
        ];
        for (const [id, w, h] of legacy) {
            const d = PLATFORM_DIMENSIONS.find(x => x.id === id);
            expect(d, `legacy row ${id} must survive registry extension`).toBeDefined();
            expect(d!.width).toBe(w);
            expect(d!.height).toBe(h);
        }
    });

    it('has unique ids and positive dimensions for every row', () => {
        const ids = new Set<string>();
        for (const d of PLATFORM_DIMENSIONS) {
            expect(ids.has(d.id)).toBe(false);
            ids.add(d.id);
            expect(d.width).toBeGreaterThan(0);
            expect(d.height).toBeGreaterThan(0);
            expect(d.label).toBeTruthy();
        }
    });
});
