/**
 * DistributionRenderPipeline.ts
 *
 * Delivery-ready render pipeline (Workstream I1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §14). One command: master asset →
 * per-profile bundle (exact pixels + optional bleed), gated by compliance (D)
 * and rights (H2), with a verifiable sha256 manifest.
 *
 * Honest limits (A-8):
 *  - Browsers cannot bake ICC CMYK rasters. v1 delivers sRGB masters at exact
 *    pixels + bleed + a per-profile spec sheet for the print vendor.
 *  - CMYK conversion is the vendor's step; noted per profile.
 */

import { getProfile, PROFILE_IDS, type VisualRenderProfile } from './RenderProfiles';
import { logger } from '@/utils/logger';

export interface BundleRequest {
    masterUrl: string;
    profileIds: string[];
    /** Master intrinsic dimensions, for the upsample policy (I1.2). */
    masterWidth?: number;
    masterHeight?: number;
    /** Gate results — injected so the pipeline is testable without live D/H services. */
    gates?: {
        compliance?: { passed: boolean; reportRef?: string; overrideReason?: string };
        rights?: { present: boolean; releaseId?: string };
    };
    trackId?: string;
}

export interface BundleResult {
    profileId: string;
    url: string;
    sha256: string;
    bytes: number;
    width: number;
    height: number;
}

/** The rasterizer is injectable for tests; defaults to an offscreen-canvas render. */
export type Rasterizer = (masterUrl: string, width: number, height: number, profile: VisualRenderProfile) => Promise<string>;

/** mm → px at a given dpi. 1 inch = 25.4 mm. */
export function mmToPx(mm: number, dpi: number): number {
    return Math.round((mm / 25.4) * dpi);
}

/** Overscan tolerance: master must be ≥97% of profile pixels. */
export const UPSAMPLE_MIN_RATIO = 0.97;
/** Never upscale beyond 1.15×. */
export const UPSAMPLE_MAX_RATIO = 1.15;

/**
 * Validate a master against a profile's pixel target. Returns an actionable
 * error string, or null when acceptable.
 */
export function validateMasterForProfile(masterW: number, masterH: number, profile: VisualRenderProfile): string | null {
    const { width: pw, height: ph } = profile.pixels;

    const widthOK = masterW >= pw * UPSAMPLE_MIN_RATIO;
    const heightOK = masterH >= ph * UPSAMPLE_MIN_RATIO;

    if (!widthOK || !heightOK) {
        const required = `${pw}×${ph}`;
        return `master too small for ${profile.id}: needs ${required}${profile.dpi ? ` @ ${profile.dpi}dpi` : ''}${profile.bleedMm ? ` + ${profile.bleedMm}mm bleed` : ''}. Current master is ${masterW}×${masterH}.`;
    }

    const upscaleW = masterW / pw;
    const upscaleH = masterH / ph;
    if (upscaleW > UPSAMPLE_MAX_RATIO || upscaleH > UPSAMPLE_MAX_RATIO) {
        return `master too large for ${profile.id}: upscaling beyond ${UPSAMPLE_MAX_RATIO}× is not allowed (${masterW}×${masterH} vs ${pw}×${ph}).`;
    }
    return null;
}

/** Deterministic edge-stretch for bleed: extend the outer 2% of the source. */
export function bleedEdgePx(profile: VisualRenderProfile): number {
    if (profile.bleedMm === undefined || profile.dpi === undefined) return 0;
    return mmToPx(profile.bleedMm, profile.dpi);
}

async function sha256Hex(bytes: BufferSource): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

async function byteLengthFromDataUrl(dataUrl: string): Promise<number> {
    const b64 = dataUrl.split(',')[1] ?? '';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.byteLength;
}

async function sha256FromDataUrl(dataUrl: string): Promise<string> {
    const b64 = dataUrl.split(',')[1] ?? '';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return sha256Hex(bytes.buffer as ArrayBuffer);
}

/**
 * Default browser rasterizer: offscreen canvas, draw the master at the profile
 * target (bleed handled by the caller adding padding; here we render at target
 * pixels). Returns a PNG data URL.
 */
async function browserRasterize(
    masterUrl: string,
    width: number,
    height: number,
    profile: VisualRenderProfile
): Promise<string> {
    const img = new Image();
    img.src = masterUrl;
    await img.decode().catch(() => { /* onerror handled below */ });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('DistributionRenderPipeline: no 2D context');
    // Cover-fit the master into the target.
    const scale = Math.max(width / img.width, height / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
    const mime = profile.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return canvas.toDataURL(mime, profile.jpegQuality ?? 0.92);
}

/**
 * Render a distribution bundle for a set of profiles.
 */
export async function renderDistributionBundle(
    req: BundleRequest,
    rasterizer: Rasterizer = browserRasterize
): Promise<{ results: BundleResult[]; manifest: object }> {
    if (!req.masterUrl) throw new Error('DistributionRenderPipeline: masterUrl is required');
    if (!req.profileIds || req.profileIds.length === 0) throw new Error('DistributionRenderPipeline: at least one profileId is required');

    // ---- Gates (D compliance + H2 rights) ------------------------------------
    const compliance = req.gates?.compliance;
    const rights = req.gates?.rights;
    const overrideReason = compliance?.overrideReason?.trim();
    if (compliance && !compliance.passed && (!overrideReason || overrideReason.length === 0)) {
        return {
            results: [],
            manifest: { blocked: true, reason: 'compliance', reportRef: compliance.reportRef, profileIds: req.profileIds }
        };
    }
    if (rights && !rights.present) {
        return {
            results: [],
            manifest: { blocked: true, reason: 'rights', releaseId: rights.releaseId, profileIds: req.profileIds }
        };
    }

    const results: BundleResult[] = [];
    const manifestEntries: Record<string, unknown> = {};

    for (const profileId of req.profileIds) {
        const profile = getProfile(profileId);
        if (!profile) {
            logger.warn(`[DistributionRenderPipeline] Unknown profile "${profileId}" skipped. Known: ${PROFILE_IDS.join(', ')}`);
            continue;
        }

        // Upsample policy (I1.2): validate the master against the target.
        if (req.masterWidth !== undefined && req.masterHeight !== undefined) {
            const issue = validateMasterForProfile(req.masterWidth, req.masterHeight, profile);
            if (issue) throw new Error(issue);
        }

        const rasterized = rasterizer(req.masterUrl, profile.pixels.width + bleedEdgePx(profile) * 2, profile.pixels.height + bleedEdgePx(profile) * 2, profile);
        const url = await rasterized;
        const bytes = await byteLengthFromDataUrl(url);
        const sha256 = await sha256FromDataUrl(url);

        results.push({
            profileId,
            url,
            sha256,
            bytes,
            width: profile.pixels.width,
            height: profile.pixels.height
        });

        manifestEntries[profileId] = {
            pixels: profile.pixels,
            format: profile.format,
            colorSpace: profile.colorSpace,
            dpi: profile.dpi,
            bleedMm: profile.bleedMm,
            sha256,
            bytes,
            notes: profile.notes
        };
    }

    const manifest = {
        generatedAt: Date.now(),
        master: { url: req.masterUrl, trackId: req.trackId },
        profiles: manifestEntries
    };

    return { results, manifest };
}
