/**
 * PrintSpec.ts
 *
 * Pure print-math planner (PRD Workstream 1 — image-upscaler-print-resolution
 * PRD). Given a source image size and a print target, returns everything the
 * rest of the pipeline needs: required pixels, the upscale factor, a
 * sufficiency verdict, an engine recommendation, and the DPI/physical
 * metadata the export path writes.
 *
 * HARD RULE: no DOM, no canvas, no I/O — same isolation shape as SmartCrop.
 * All quality thresholds live here so they are testable and tunable in one
 * place.
 */

// ---------------------------------------------------------------------------
// Thresholds (single place — tunable, tested)
// ---------------------------------------------------------------------------

/** Maximum credible upscale factor for Real-ESRGAN-class engines. */
export const MAX_CREDIBLE_UPSCALE = 4;

/** Beyond this aspect-ratio change a print target implies destructive cropping. */
export const PRINT_EXTREME_ASPECT_THRESHOLD = 1.6;

// ---------------------------------------------------------------------------
// Media presets (data, not logic)
// ---------------------------------------------------------------------------

export type PrintMediaCategory = 'physical' | 'distributor' | 'digital';

export interface PrintMediaPreset {
    id: string;
    label: string;
    category: PrintMediaCategory;
    /** Physical target size in inches. */
    widthIn: number;
    heightIn: number;
    /** Target print DPI — what the export should be tagged with. */
    dpi: number;
    /** Below this DPI the print looks visibly soft even when "it fits". */
    minDpi: number;
    /** Hard pixel floor (e.g. distributor specs) applied on top of inches×DPI. */
    minPixels?: { width: number; height: number };
    /** Extra artwork outside the finished trim on each edge. */
    bleedIn?: number;
    /** Keep type, logos, and other essential content this far inside trim. */
    safeIn?: number;
    /** Provider-specific handoff instructions; no one color space fits every printer. */
    handoff?: string;
}

export const PRINT_MEDIA_PRESETS: readonly PrintMediaPreset[] = [
    {
        id: 'vinyl_sleeve',
        label: 'Vinyl sleeve (12.375″)',
        category: 'physical',
        widthIn: 12.375,
        heightIn: 12.375,
        dpi: 300,
        minDpi: 300,
        bleedIn: 0.125,
        safeIn: 0.125,
        handoff: 'Vinyl jackets require the manufacturer’s exact dieline for spine, folds, and cutouts. Supply a 300 PPI CMYK PDF with embedded fonts when requested; confirm its bleed against that template.',
    },
    {
        id: 'cassette_jcard',
        label: 'Cassette J-card (4×2.5″)',
        category: 'physical',
        widthIn: 4,
        heightIn: 2.5,
        dpi: 300,
        minDpi: 300,
        bleedIn: 0.125,
        safeIn: 0.125,
        handoff: 'Use the manufacturer’s J-card dieline for panels and folds; this flat size is a planning estimate.',
    },
    {
        id: 'poster_11x17',
        label: 'Poster 11×17″',
        category: 'physical',
        widthIn: 11,
        heightIn: 17,
        dpi: 300,
        minDpi: 150,
        bleedIn: 0.125,
        safeIn: 0.125,
    },
    {
        id: 'poster_18x24',
        label: 'Poster 18×24″',
        category: 'physical',
        widthIn: 18,
        heightIn: 24,
        dpi: 300,
        minDpi: 150,
        bleedIn: 0.125,
        safeIn: 0.125,
    },
    {
        id: 'poster_24x36',
        label: 'Poster 24×36″',
        category: 'physical',
        widthIn: 24,
        heightIn: 36,
        dpi: 300,
        minDpi: 150,
        bleedIn: 0.125,
        safeIn: 0.125,
    },
    {
        id: 'dtf_12x16',
        label: 'DTF transfer 12×16″',
        category: 'physical',
        widthIn: 12,
        heightIn: 16,
        dpi: 300,
        minDpi: 300,
        handoff: 'For Printful, use the selected product’s print-area template and export an sRGB PNG with transparency where needed. Apparel print areas do not use a universal paper bleed.',
    },
    {
        id: 'cover_art_distributor',
        label: 'Distributor cover art (3000×3000)',
        category: 'distributor',
        widthIn: 10,
        heightIn: 10,
        dpi: 300,
        minDpi: 300,
        minPixels: { width: 3000, height: 3000 },
        handoff: 'Digital distributor cover art has no trim bleed. Export the square 3000 × 3000 file separately from physical packaging artwork.',
    },
    {
        id: 'flyer_letter',
        label: 'Flyer 8.5×11″ (general printer)',
        category: 'physical',
        widthIn: 8.5,
        heightIn: 11,
        dpi: 300,
        minDpi: 300,
        bleedIn: 0.125,
        safeIn: 0.125,
        handoff: 'Confirm the shop’s template, color profile, accepted PDF standard, and whether crop marks are wanted before sending to press.',
    },
    {
        id: 'gotprint_flyer_letter',
        label: 'GotPrint flyer 8.5×11″',
        category: 'physical',
        widthIn: 8.5,
        heightIn: 11,
        dpi: 350,
        minDpi: 350,
        bleedIn: 0.125,
        safeIn: 0.125,
        handoff: 'GotPrint specifies 350 DPI and CMYK for flyers. Use its product template and proof before ordering; an RGB PNG alone is not a verified CMYK handoff.',
    },
    {
        id: 'social_1080x1350',
        label: 'Social feed (1080×1350)',
        category: 'digital',
        widthIn: 15,
        heightIn: 18.75,
        dpi: 72,
        minDpi: 72,
    },
] as const;

export function getPrintPreset(id: string): PrintMediaPreset | undefined {
    return PRINT_MEDIA_PRESETS.find(p => p.id === id);
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export type PrintVerdict = 'sufficient' | 'upscale' | 'insufficient';

export type RecommendedEngine = 'none' | 'local' | 'hosted' | 'tile-refine';

export interface PrintPlanInput {
    srcWidth: number;
    srcHeight: number;
    presetId: string;
}

export interface PrintPlan {
    presetId: string;
    /** Pixels the print target requires (inches × DPI, or the pixel floor if higher). */
    required: { width: number; height: number };
    source: { width: number; height: number };
    dpi: number;
    trim: { widthIn: number; heightIn: number };
    bleedIn: number;
    safeIn: number;
    handoff?: string;
    /** Cover-fit factor: how far the source is from the required size. ≤1 means already sufficient. */
    requiredUpscaleFactor: number;
    verdict: PrintVerdict;
    recommendedEngine: RecommendedEngine;
    /** Values the export path writes: exact pixel dims + DPI metadata. */
    exportMeta: {
        pixelWidth: number;
        pixelHeight: number;
        dpi: number;
        widthIn: number;
        heightIn: number;
        trimWidthIn: number;
        trimHeightIn: number;
        bleedIn: number;
        safeIn: number;
    };
    /** Human-readable summary, e.g. "12.38 × 12.38 in @ 300 DPI (3713 × 3713 px)". */
    summary: string;
    warnings: string[];
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * Plan the print output for a source image against a media preset.
 *
 * - `sufficient`   — source already covers the target at target DPI.
 * - `upscale`      — reachable within MAX_CREDIBLE_UPSCALE via an SR engine.
 * - `insufficient` — even a maximal credible upscale cannot reach the target;
 *                    warnings say what the best achievable DPI would be.
 */
export function planPrintOutput({ srcWidth, srcHeight, presetId }: PrintPlanInput): PrintPlan {
    const preset = getPrintPreset(presetId);
    if (!preset) throw new Error(`PrintSpec: unknown preset id "${presetId}"`);
    if (!(srcWidth > 0 && srcHeight > 0)) throw new Error('PrintSpec: source dimensions must be positive');

    const bleedIn = preset.bleedIn ?? 0;
    const safeIn = preset.safeIn ?? 0;
    const fullWidthIn = preset.widthIn + bleedIn * 2;
    const fullHeightIn = preset.heightIn + bleedIn * 2;
    const required = {
        width: Math.max(Math.ceil(fullWidthIn * preset.dpi), preset.minPixels?.width ?? 0),
        height: Math.max(Math.ceil(fullHeightIn * preset.dpi), preset.minPixels?.height ?? 0),
    };

    const requiredUpscaleFactor = Math.max(required.width / srcWidth, required.height / srcHeight);

    const warnings: string[] = [];

    // Aspect drift: printing onto a very different aspect implies destructive
    // crop or letterboxing — flag it regardless of resolution.
    const srcAspect = srcWidth / srcHeight;
    const dstAspect = required.width / required.height;
    const aspectRatio = srcAspect > dstAspect ? srcAspect / dstAspect : dstAspect / srcAspect;
    if (aspectRatio > PRINT_EXTREME_ASPECT_THRESHOLD) {
        warnings.push(
            `Aspect mismatch: source ${round2(srcAspect)}:1 vs target ${round2(dstAspect)}:1 — ` +
            'the print will crop or pad noticeably.',
        );
    }

    let verdict: PrintVerdict;
    if (requiredUpscaleFactor <= 1) {
        verdict = 'sufficient';
    } else if (requiredUpscaleFactor <= MAX_CREDIBLE_UPSCALE) {
        verdict = 'upscale';
    } else {
        verdict = 'insufficient';
        const bestDpi = Math.round(Math.min(srcWidth / fullWidthIn, srcHeight / fullHeightIn) * MAX_CREDIBLE_UPSCALE);
        warnings.push(
            `Target needs ${required.width} × ${required.height} px; a ${MAX_CREDIBLE_UPSCALE}× upscale reaches ` +
            `about ${bestDpi} DPI here — below the ${preset.minDpi} DPI floor. ` +
            'Consider a smaller print size or accept reduced detail.',
        );
    }

    // Note: for 'upscale' verdicts the cover-fit factor guarantees the binding
    // dimension lands exactly on target DPI, so no extra soft-DPI guard is
    // needed there — 'insufficient' already reports achievable DPI vs floor.

    const recommendedEngine: RecommendedEngine =
        verdict === 'sufficient' ? 'none'
        : verdict === 'insufficient' ? 'tile-refine'
        : 'local';

    const summary =
        `${round2(preset.widthIn)} × ${round2(preset.heightIn)} in trim @ ${preset.dpi} DPI ` +
        `(${required.width} × ${required.height} px${bleedIn ? ` incl. ${bleedIn}″ bleed/side` : ''})`;

    return {
        presetId,
        required,
        source: { width: srcWidth, height: srcHeight },
        dpi: preset.dpi,
        trim: { widthIn: preset.widthIn, heightIn: preset.heightIn },
        bleedIn,
        safeIn,
        handoff: preset.handoff,
        requiredUpscaleFactor: round2(requiredUpscaleFactor),
        verdict,
        recommendedEngine,
        exportMeta: {
            pixelWidth: required.width,
            pixelHeight: required.height,
            dpi: preset.dpi,
            widthIn: fullWidthIn,
            heightIn: fullHeightIn,
            trimWidthIn: preset.widthIn,
            trimHeightIn: preset.heightIn,
            bleedIn,
            safeIn,
        },
        summary,
        warnings,
    };
}
