import { describe, expect, it } from 'vitest';
import {
    PRINT_MEDIA_PRESETS,
    MAX_CREDIBLE_UPSCALE,
    PRINT_EXTREME_ASPECT_THRESHOLD,
    getPrintPreset,
    planPrintOutput,
} from '../PrintSpec';

describe('PRINT_MEDIA_PRESETS (data sanity)', () => {
    it('covers the PRD media list with unique ids', () => {
        const ids = PRINT_MEDIA_PRESETS.map(p => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const required of [
            'vinyl_sleeve', 'cassette_jcard', 'poster_11x17', 'poster_18x24',
            'poster_24x36', 'dtf_12x16', 'cover_art_distributor', 'social_1080x1350',
        ]) {
            expect(ids).toContain(required);
        }
    });

    it('getPrintPreset resolves known ids and rejects unknown ones', () => {
        expect(getPrintPreset('vinyl_sleeve')?.dpi).toBe(300);
        expect(getPrintPreset('nope')).toBeUndefined();
    });
});

describe('planPrintOutput — verdicts', () => {
    it('4K square source is sufficient for a vinyl sleeve', () => {
        const plan = planPrintOutput({ srcWidth: 4096, srcHeight: 4096, presetId: 'vinyl_sleeve' });
        expect(plan.verdict).toBe('sufficient');
        expect(plan.recommendedEngine).toBe('none');
        expect(plan.requiredUpscaleFactor).toBeLessThanOrEqual(1);
        expect(plan.required).toEqual({ width: 3713, height: 3713 }); // 12.375 × 300
        expect(plan.exportMeta).toEqual({
            pixelWidth: 3713,
            pixelHeight: 3713,
            dpi: 300,
            widthIn: 12.375,
            heightIn: 12.375,
        });
        expect(plan.summary).toContain('12.38 × 12.38 in @ 300 DPI');
        expect(plan.warnings).toHaveLength(0);
    });

    it('2K square source needs an upscale for vinyl and gets the local engine', () => {
        const plan = planPrintOutput({ srcWidth: 2048, srcHeight: 2048, presetId: 'vinyl_sleeve' });
        expect(plan.verdict).toBe('upscale');
        expect(plan.recommendedEngine).toBe('local');
        expect(plan.requiredUpscaleFactor).toBeCloseTo(3713 / 2048, 2);
        expect(plan.requiredUpscaleFactor).toBeLessThanOrEqual(MAX_CREDIBLE_UPSCALE);
    });

    it('2K source cannot credibly reach a 24×36 poster — insufficient with honest DPI math', () => {
        const plan = planPrintOutput({ srcWidth: 2048, srcHeight: 2048, presetId: 'poster_24x36' });
        // required 7200 × 10800; binding side 10800/2048 ≈ 5.27 > 4×
        expect(plan.verdict).toBe('insufficient');
        expect(plan.recommendedEngine).toBe('tile-refine');
        expect(plan.requiredUpscaleFactor).toBeGreaterThan(MAX_CREDIBLE_UPSCALE);
        expect(plan.warnings[0]).toContain(`a ${MAX_CREDIBLE_UPSCALE}× upscale reaches`);
        // best achievable = min(2048/24, 2048/36) × 4 = 227.6 → 228 DPI
        expect(plan.warnings[0]).toContain('228 DPI');
        expect(plan.warnings[0]).toContain('150 DPI floor');
    });

    it('distributor cover art enforces the 3000×3000 pixel floor over inches×DPI', () => {
        const plan = planPrintOutput({ srcWidth: 2048, srcHeight: 2048, presetId: 'cover_art_distributor' });
        expect(plan.required).toEqual({ width: 3000, height: 3000 });
        expect(plan.verdict).toBe('upscale'); // factor 1.46
        expect(plan.exportMeta.pixelWidth).toBe(3000);
    });

    it('a source already at the distributor floor is sufficient', () => {
        const plan = planPrintOutput({ srcWidth: 3000, srcHeight: 3000, presetId: 'cover_art_distributor' });
        expect(plan.verdict).toBe('sufficient');
        expect(plan.recommendedEngine).toBe('none');
        expect(plan.warnings).toHaveLength(0);
    });

    it('digital social target is trivially covered by generation output', () => {
        const plan = planPrintOutput({ srcWidth: 2048, srcHeight: 2048, presetId: 'social_1080x1350' });
        expect(plan.verdict).toBe('sufficient');
    });
});

describe('planPrintOutput — warnings and guards', () => {
    it('flags extreme aspect mismatch when resolution still needs an upscale', () => {
        // 8000×2000 is 4:1 against a 1:1 sleeve — ratio 4 > 1.6 threshold —
        // and the short side still needs a 1.86× upscale.
        const plan = planPrintOutput({ srcWidth: 8000, srcHeight: 2000, presetId: 'vinyl_sleeve' });
        expect(plan.verdict).toBe('upscale');
        expect(plan.requiredUpscaleFactor).toBeCloseTo(3713 / 2000, 2);
        expect(plan.warnings.some(w => w.startsWith('Aspect mismatch'))).toBe(true);
    });

    it('a matching-aspect source produces no warnings', () => {
        const plan = planPrintOutput({ srcWidth: 1500, srcHeight: 1500, presetId: 'cover_art_distributor' });
        expect(plan.verdict).toBe('upscale');
        expect(plan.warnings).toHaveLength(0);
        expect(PRINT_EXTREME_ASPECT_THRESHOLD).toBe(1.6);
    });

    it('rejects invalid source dimensions and unknown presets', () => {
        expect(() => planPrintOutput({ srcWidth: 0, srcHeight: 100, presetId: 'vinyl_sleeve' })).toThrow(/positive/);
        expect(() => planPrintOutput({ srcWidth: 100, srcHeight: -5, presetId: 'vinyl_sleeve' })).toThrow(/positive/);
        expect(() => planPrintOutput({ srcWidth: 100, srcHeight: 100, presetId: 'nope' })).toThrow(/unknown preset/);
    });
});
