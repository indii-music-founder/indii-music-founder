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
    },
    {
        id: 'cassette_jcard',
        label: 'Cassette J-card (4×2.5″)',
        category: 'physical',
        widthIn: 4,
        heightIn: 2.5,
        dpi: 300,
        minDpi: 300,
    },
    {
        id: 'poster_11x17',
        label: 'Poster 11×17″',
        category: 'physical',
        widthIn: 11,
        heightIn: 17,
        dpi: 300,
        minDpi: 150,
    },
    {
        id: 'poster_18x24',
        label: 'Poster 18×24″',
        category: 'physical',
        widthIn: 18,
        heightIn: 24,
        dpi: 300,
        minDpi: 150,
    },
    {
        id: 'poster_24x36',
        label: 'Poster 24×36″',
        category: 'physical',
        widthIn: 24,
        heightIn: 36,
        dpi: 300,
        minDpi: 150,
    },
    {
        id: 'dtf_12x16',
        label: 'DTF transfer 12×16″',
        category: 'physical',
        widthIn: 12,
        heightIn: 16,
        dpi: 300,
        minDpi: 300,
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

    const required = {
        width: Math.max(Math.ceil(preset.widthIn * preset.dpi), preset.minPixels?.width ?? 0),
        height: Math.max(Math.ceil(preset.heightIn * preset.dpi), preset.minPixels?.height ?? 0),
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
        const bestDpi = Math.round(Math.min(srcWidth / preset.widthIn, srcHeight / preset.heightIn) * MAX_CREDIBLE_UPSCALE);
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
        `${round2(preset.widthIn)} × ${round2(preset.heightIn)} in @ ${preset.dpi} DPI ` +
        `(${required.width} × ${required.height} px)`;

    return {
        presetId,
        required,
        source: { width: srcWidth, height: srcHeight },
        dpi: preset.dpi,
        requiredUpscaleFactor: round2(requiredUpscaleFactor),
        verdict,
        recommendedEngine,
        exportMeta: {
            pixelWidth: required.width,
            pixelHeight: required.height,
            dpi: preset.dpi,
            widthIn: preset.widthIn,
            heightIn: preset.heightIn,
        },
        summary,
        warnings,
    };
}
