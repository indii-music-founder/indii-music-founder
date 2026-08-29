import { describe, expect, it, vi } from 'vitest';
import {
    createDefaultVisionProbe,
    mergeConfig,
    scanAsset,
    type ComplianceVisionProbe,
    type ScanDeps,
} from './BrandComplianceService';
import type { Box2D } from '@/services/image/ImageAnalysisService';
import type { BrandKit } from '@/types/User';

const ASSET = 'data:image/png;base64,AAA';

function brandKit(partial: Partial<BrandKit> = {}): BrandKit {
    return {
        colors: ['#FF0000'],
        fonts: '',
        brandDescription: 'test brand',
        negativePrompt: '',
        socials: {} as BrandKit['socials'],
        brandAssets: [],
        referenceImages: [],
        releaseDetails: {} as BrandKit['releaseDetails'],
        ...partial,
    };
}

function fakeExtract(clusters: Array<{ hex: string; coverage: number }>): ScanDeps['extractColors'] {
    return vi.fn().mockResolvedValue(clusters);
}

function fakeProbe(box: Box2D | null): ComplianceVisionProbe {
    return { detectLogo: vi.fn().mockResolvedValue(box) };
}

describe('mergeConfig', () => {
    it('keeps defaults and applies partial overrides', () => {
        const cfg = mergeConfig({ colorToleranceDeltaE: 5 });
        expect(cfg.colorToleranceDeltaE).toBe(5);
        expect(cfg.colorCoverageMinPct).toBe(8);
        expect(cfg.passScore).toBe(85);
    });
});

describe('scanAsset — color rule', () => {
    it('flags an off-palette dominant color as an error with evidence', async () => {
        const report = await scanAsset(ASSET, brandKit({ colors: ['#000000'] }), undefined, {
            extractColors: fakeExtract([
                { hex: '#FF00FF', coverage: 0.5 },
                { hex: '#010101', coverage: 0.3 },
            ]),
        });
        const colorErrors = report.violations.filter((v) => v.type === 'color' && v.severity === 'error');
        expect(colorErrors).toHaveLength(1);
        expect(colorErrors[0]!.evidence?.foundHex).toBe('#FF00FF');
        expect(colorErrors[0]!.evidence?.nearestBrandHex).toBe('#000000');
        expect(colorErrors[0]!.evidence?.deltaE).toBeGreaterThan(12);
        expect(report.passed).toBe(false);
        expect(report.score).toBe(75);
    });

    it('passes when dominant colors sit within ΔE tolerance', async () => {
        const report = await scanAsset(ASSET, brandKit({ colors: ['#FF0000'] }), undefined, {
            extractColors: fakeExtract([{ hex: '#FE0101', coverage: 0.9 }]),
        });
        expect(report.violations).toHaveLength(0);
        expect(report.passed).toBe(true);
        expect(report.score).toBe(100);
    });

    it('ignores clusters below the coverage minimum', async () => {
        const report = await scanAsset(ASSET, brandKit({ colors: ['#000000'] }), undefined, {
            extractColors: fakeExtract([{ hex: '#FF00FF', coverage: 0.05 }]),
        });
        expect(report.violations.filter((v) => v.type === 'color')).toHaveLength(0);
    });

    it('warns (never errors) when the brand kit defines no palette', async () => {
        const report = await scanAsset(ASSET, brandKit({ colors: [] }), undefined, {
            extractColors: fakeExtract([{ hex: '#FF00FF', coverage: 1 }]),
        });
        expect(report.violations).toHaveLength(1);
        expect(report.violations[0]!.type).toBe('color');
        expect(report.violations[0]!.severity).toBe('warning');
        expect(report.passed).toBe(true);
    });

    it('skips invalid hex entries in the palette instead of crashing', async () => {
        const report = await scanAsset(ASSET, brandKit({ colors: ['garbage', '#FF0000'] }), undefined, {
            extractColors: fakeExtract([{ hex: '#FE0101', coverage: 0.9 }]),
        });
        expect(report.passed).toBe(true);
    });
});

describe('scanAsset — typography rule', () => {
    it('marks raster font usage as an unverifiable warning when fonts are declared', async () => {
        const report = await scanAsset(ASSET, brandKit({ fonts: 'Geist, Inter' }), undefined, {
            extractColors: fakeExtract([]),
        });
        const typography = report.violations.filter((v) => v.type === 'typography');
        expect(typography).toHaveLength(1);
        expect(typography[0]!.severity).toBe('warning');
        expect(typography[0]!.detail).toContain('Geist');
    });

    it('stays silent about typography when no fonts are declared', async () => {
        const report = await scanAsset(ASSET, brandKit({ fonts: '' }), undefined, {
            extractColors: fakeExtract([]),
        });
        expect(report.violations.filter((v) => v.type === 'typography')).toHaveLength(0);
    });
});

describe('scanAsset — logo + safe zone rules', () => {
    it('errors when a logo is required but none exists in the brand kit', async () => {
        const report = await scanAsset(ASSET, brandKit(), { requireLogo: true }, {
            extractColors: fakeExtract([]),
        });
        const logo = report.violations.find((v) => v.type === 'logo');
        expect(logo?.severity).toBe('error');
        expect(report.passed).toBe(false);
    });

    it('errors when the required logo is not detected', async () => {
        const report = await scanAsset(ASSET, brandKit({ brandAssets: [{ url: 'logo.png', description: 'Dii mark', category: 'logo' }] }), { requireLogo: true }, {
            extractColors: fakeExtract([]),
            vision: fakeProbe(null),
        });
        expect(report.violations.find((v) => v.type === 'logo')?.severity).toBe('error');
    });

    it('flags a detected logo outside the safe zone with box evidence', async () => {
        const cornerBox: Box2D = { ymin: 0.0, xmin: 0.0, ymax: 0.04, xmax: 0.04 };
        const report = await scanAsset(
            ASSET,
            brandKit({ brandAssets: [{ url: 'logo.png', description: 'Dii mark', category: 'logo' }] }),
            { requireLogo: true, logoSafeZonePct: 5 },
            { extractColors: fakeExtract([]), vision: fakeProbe(cornerBox) }
        );
        const violation = report.violations.find((v) => v.type === 'safe-zone');
        expect(violation?.severity).toBe('error');
        expect(violation?.evidence?.box).toEqual(cornerBox);
    });

    it('accepts a detected logo inside the safe zone', async () => {
        const centeredBox: Box2D = { ymin: 0.45, xmin: 0.45, ymax: 0.55, xmax: 0.55 };
        const report = await scanAsset(
            ASSET,
            brandKit({ brandAssets: [{ url: 'logo.png', description: 'Dii mark', category: 'logo' }] }),
            { requireLogo: true, logoSafeZonePct: 5 },
            { extractColors: fakeExtract([]), vision: fakeProbe(centeredBox) }
        );
        expect(report.violations).toHaveLength(0);
        expect(report.passed).toBe(true);
    });

    it('does not run logo detection when requireLogo is false', async () => {
        const probe = fakeProbe(null);
        await scanAsset(ASSET, brandKit(), { requireLogo: false }, {
            extractColors: fakeExtract([]),
            vision: probe,
        });
        expect(probe.detectLogo).not.toHaveBeenCalled();
    });
});

describe('scanAsset — report shape', () => {
    it('scores deterministically: 100 − 25·errors − 10·warnings, clamped at 0', async () => {
        const report = await scanAsset(
            ASSET,
            brandKit({ colors: ['#000000'], fonts: 'Geist', brandAssets: [{ url: 'l.png', description: 'l', category: 'logo' }] }),
            { requireLogo: true },
            {
                extractColors: fakeExtract([
                    { hex: '#FF00FF', coverage: 0.4 },
                    { hex: '#00FF00', coverage: 0.4 },
                ]),
                vision: fakeProbe(null),
            }
        );
        // 2 color errors + 1 logo error + 1 typography warning = 100 - 85 = 15
        expect(report.score).toBe(15);
        expect(report.passed).toBe(false);
    });

    it('clamps the score at zero', async () => {
        const report = await scanAsset(
            ASSET,
            brandKit({ colors: ['#000000'], fonts: 'Geist', brandAssets: [{ url: 'l.png', description: 'l', category: 'logo' }] }),
            { requireLogo: true },
            {
                extractColors: fakeExtract([
                    { hex: '#FF00FF', coverage: 0.3 },
                    { hex: '#00FF00', coverage: 0.3 },
                    { hex: '#0033FF', coverage: 0.3 },
                ]),
                vision: fakeProbe(null),
            }
        );
        expect(report.score).toBe(0);
    });

    it('emits violations in stable order and carries caller identity', async () => {
        const report = await scanAsset(
            ASSET,
            brandKit({ colors: ['#000000'], fonts: 'Geist', brandAssets: [{ url: 'l.png', description: 'l', category: 'logo' }] }),
            { requireLogo: true },
            {
                assetId: 'history-123',
                extractColors: fakeExtract([{ hex: '#FF00FF', coverage: 0.4 }]),
                vision: fakeProbe(null),
            }
        );
        expect(report.violations.map((v) => v.type)).toEqual(['color', 'typography', 'logo']);
        expect(report.assetId).toBe('history-123');
        expect(report.engine).toBe('pixel');
    });
});

describe('createDefaultVisionProbe', () => {
    it('is a callable probe contract (structural — real vision proof lands at D2.3)', () => {
        const probe = createDefaultVisionProbe();
        expect(typeof probe.detectLogo).toBe('function');
    });
});
