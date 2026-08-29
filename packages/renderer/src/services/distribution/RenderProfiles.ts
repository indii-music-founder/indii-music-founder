/**
 * RenderProfiles.ts
 *
 * Visual delivery render profiles (Workstream I1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §14). A profile is a target spec for
 * one DSP / print house: exact pixels, format, color space, optional DPI/bleed/
 * byte cap, and human notes.
 *
 * Honest limit (A-8): browsers cannot bake ICC/CMYK press rasters — v1 delivers
 * sRGB masters at exact pixels + bleed + a per-profile spec sheet for the print
 * vendor. DSP cover specs (3000×3000 sRGB under MAX_COVER_BYTES) are fully in
 * scope.
 */

export interface VisualRenderProfile {
    id: string;
    label: string;
    pixels: { width: number; height: number };
    format: 'jpeg' | 'png';
    colorSpace: 'sRGB';
    dpi?: number;
    bleedMm?: number;
    maxBytes?: number;
    jpegQuality?: number;
    squareOnly?: boolean;
    notes: string[];
}

function profile(p: VisualRenderProfile): VisualRenderProfile {
    return p;
}

export const RENDER_PROFILES: Record<string, VisualRenderProfile> = {
    'spotify-cover': profile({
        id: 'spotify-cover',
        label: 'Spotify Cover',
        pixels: { width: 3000, height: 3000 },
        format: 'jpeg',
        colorSpace: 'sRGB',
        maxBytes: 50 * 1024 * 1024,
        jpegQuality: 0.92,
        squareOnly: true,
        notes: ['3000×3000 sRGB JPEG (Spotify requires ≥3000px), <50MB, no bleed.']
    }),
    'apple-itunes-cover': profile({
        id: 'apple-itunes-cover',
        label: 'Apple / iTunes Cover',
        pixels: { width: 3000, height: 3000 },
        format: 'png',
        colorSpace: 'sRGB',
        maxBytes: 50 * 1024 * 1024,
        squareOnly: true,
        notes: ['3000×3000 sRGB PNG (Apple min 1400px), <50MB.']
    }),
    'print-12in-sleeve-300dpi': profile({
        id: 'print-12in-sleeve-300dpi',
        label: '12-inch Vinyl Sleeve (300dpi)',
        pixels: { width: 3728, height: 3728 },
        format: 'png',
        colorSpace: 'sRGB',
        dpi: 300,
        bleedMm: 5,
        squareOnly: true,
        notes: ['Print-handoff sRGB master at 300dpi with 5mm bleed. Vendor applies CMYK conversion.']
    }),
    'cd-jewel-300dpi': profile({
        id: 'cd-jewel-300dpi',
        label: 'CD Jewel Case (300dpi)',
        pixels: { width: 1734, height: 1734 },
        format: 'jpeg',
        colorSpace: 'sRGB',
        dpi: 300,
        jpegQuality: 0.95,
        squareOnly: true,
        notes: ['CD insert front 4.75in square @300dpi with 5mm bleed.']
    }),
    'youtube-thumbnail': profile({
        id: 'youtube-thumbnail',
        label: 'YouTube Thumbnail',
        pixels: { width: 1280, height: 1280 * 9 / 16 },
        format: 'jpeg',
        colorSpace: 'sRGB',
        jpegQuality: 0.9,
        notes: ['1280×720 sRGB JPEG, <2MB.']
    })
};

export function validateProfile(p: VisualRenderProfile): string[] {
    const errors: string[] = [];
    if (p.pixels.width <= 0 || p.pixels.height <= 0) errors.push(`${p.id}: pixels must be positive`);
    if (p.format !== 'jpeg' && p.format !== 'png') errors.push(`${p.id}: unsupported format ${p.format}`);
    if (p.colorSpace !== 'sRGB') errors.push(`${p.id}: colorSpace must be sRGB`);
    if (p.bleedMm !== undefined && p.dpi === undefined) {
        errors.push(`${p.id}: bleed requires a dpi (cannot convert mm to px without dpi)`);
    }
    return errors;
}

export function getProfile(id: string): VisualRenderProfile | null {
    return RENDER_PROFILES[id] ?? null;
}

export const PROFILE_IDS = Object.keys(RENDER_PROFILES);
