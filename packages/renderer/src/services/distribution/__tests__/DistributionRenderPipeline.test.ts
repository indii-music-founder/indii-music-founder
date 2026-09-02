import { describe, it, expect, vi } from 'vitest';
import { RENDER_PROFILES, validateProfile, getProfile } from '../RenderProfiles';
import {
    validateMasterForProfile,
    mmToPx,
    bleedEdgePx,
    renderDistributionBundle,
    UPSAMPLE_MAX_RATIO
} from '../DistributionRenderPipeline';

describe('profile table (I1.1)', () => {
    it('every registered profile passes its own validator', () => {
        for (const p of Object.values(RENDER_PROFILES)) {
            expect(validateProfile(p), p.id).toEqual([]);
        }
    });

    it('contains the four founder-required profiles with exact specs', () => {
        expect(getProfile('spotify-cover')!.pixels).toEqual({ width: 3000, height: 3000 });
        expect(getProfile('apple-itunes-cover')!.pixels).toEqual({ width: 3000, height: 3000 });
        expect(getProfile('print-12in-sleeve-300dpi')!.dpi).toBe(300);
        expect(getProfile('print-12in-sleeve-300dpi')!.bleedMm).toBe(5);
    });

    it('rejects an invalid profile (bleed without dpi)', () => {
        const bad = { id: 'x', label: 'x', pixels: { width: 100, height: 100 }, format: 'jpeg' as const, colorSpace: 'sRGB' as const, bleedMm: 5, notes: [] as string[] };
        expect(validateProfile(bad).join(' ')).toContain('bleed requires a dpi');
        const neg = { id: 'y', label: 'y', pixels: { width: -1, height: 0 }, format: 'png' as const, colorSpace: 'sRGB' as const, notes: [] as string[] };
        expect(validateProfile(neg).length).toBeGreaterThan(0);
    });
});

describe('upsample policy (I1.2)', () => {
    const spotify = getProfile('spotify-cover')!; // 3000x3000
    it('accepts a master at or above the target', () => {
        expect(validateMasterForProfile(3000, 3000, spotify)).toBeNull();
        expect(validateMasterForProfile(3100, 3000, spotify)).toBeNull();
    });
    it('rejects an undersized master with an actionable message', () => {
        const err = validateMasterForProfile(2000, 2000, spotify);
        expect(err).toMatch(/master too small for spotify-cover/);
        expect(err).toMatch(/needs 3000×3000/);
    });
    it('rejects an over-upscale master beyond 1.15×', () => {
        const err = validateMasterForProfile(Math.round(3000 * UPSAMPLE_MAX_RATIO) + 1, 3000, spotify);
        expect(err).toMatch(/upscaling beyond/);
    });
    it('the 1.15× boundary itself is accepted', () => {
        expect(validateMasterForProfile(Math.round(3000 * UPSAMPLE_MAX_RATIO), 3000, spotify)).toBeNull();
    });
});

describe('bleed math (I1.3)', () => {
    it('mm → px at 300dpi', () => {
        expect(mmToPx(5, 300)).toBe(59);
        expect(mmToPx(0, 300)).toBe(0);
    });
    it('bleed edge px is deterministic per profile', () => {
        expect(bleedEdgePx(getProfile('print-12in-sleeve-300dpi')!)).toBe(59);
        expect(bleedEdgePx(getProfile('spotify-cover')!)).toBe(0);
    });
});

describe('gates (I1.4)', () => {
    const req = { masterUrl: 'data:image/png;base64,QUJD', profileIds: ['spotify-cover'], masterWidth: 3000, masterHeight: 3000 };
    const fakeRaster = vi.fn(async (_m: string, w: number, h: number, _p: unknown) => {
        const payload = 'A'.repeat(Math.max(8, Math.round((w * h) / 1000)));
        return `data:image/png;base64,${payload}`;
    });

    it('blocks when compliance fails without an override', async () => {
        const out = await renderDistributionBundle({ ...req, gates: { compliance: { passed: false, reportRef: 'rep_1' } } }, fakeRaster);
        expect(out.results).toHaveLength(0);
        expect(out.manifest).toMatchObject({ blocked: true, reason: 'compliance', reportRef: 'rep_1' });
    });
    it('blocks when the rights record is missing', async () => {
        const out = await renderDistributionBundle({ ...req, gates: { rights: { present: false } } }, fakeRaster);
        expect(out.results).toHaveLength(0);
        expect(out.manifest).toMatchObject({ blocked: true, reason: 'rights' });
    });
    it('allows when gates pass or are absent', async () => {
        const out = await renderDistributionBundle({
            ...req,
            gates: { compliance: { passed: true }, rights: { present: true, releaseId: 'rel' } }
        }, fakeRaster);
        expect(out.results.length).toBeGreaterThan(0);
    });
});

describe('manifest (I1.5)', () => {
    const fakeRaster = vi.fn(async (_m: string, w: number, h: number, _p: unknown) => {
        const payload = 'B'.repeat(Math.max(8, Math.round((w * h) / 1000)));
        return `data:image/png;base64,${payload}`;
    });

    it('carries sha256 + profile snapshot matching the registry', async () => {
        const { results, manifest } = await renderDistributionBundle({
            masterUrl: 'data:image/png;base64,QUJD',
            profileIds: ['spotify-cover', 'apple-itunes-cover'],
            masterWidth: 3000,
            masterHeight: 3000
        }, fakeRaster);

        expect(results).toHaveLength(2);
        for (const r of results) {
            expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
            expect(r.bytes).toBeGreaterThan(0);
            expect(r.width).toBe(3000);
            expect(r.height).toBe(3000);
        }
        const m = manifest as { profiles: Record<string, unknown> };
        expect(m.profiles['spotify-cover']).toMatchObject({ pixels: { width: 3000, height: 3000 }, format: 'jpeg', colorSpace: 'sRGB' });
        expect((m.profiles['spotify-cover'] as { sha256: string }).sha256).toBe(results.find(r => r.profileId === 'spotify-cover')!.sha256);
    });

    it('throws the actionable upsample error before rendering', async () => {
        await expect(renderDistributionBundle({
            masterUrl: 'data:image/png;base64,QUJD',
            profileIds: ['print-12in-sleeve-300dpi'],
            masterWidth: 2000,
            masterHeight: 2000
        }, fakeRaster)).rejects.toThrow(/master too small for print-12in-sleeve-300dpi/);
    });
});
