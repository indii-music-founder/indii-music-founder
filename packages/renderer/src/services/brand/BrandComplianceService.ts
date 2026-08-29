/**
 * BrandComplianceService — deterministic pixel-engine scan of an asset against
 * the user's Brand Kit (docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md, Workstream D).
 *
 * Phase D1 scope: color (ΔE2000), typography (honest unverifiable warning for
 * raster-only assets), logo presence + safe zone (via an injectable vision probe).
 * Phase D2 adds the aesthetic vision engine, the ship gate, and the agent tool.
 */
import type { BrandKit } from '@/types/User';
import type { Box2D } from '@/services/image/ImageAnalysisService';
import { deltaE2000, extractDominantColors, srgbToLab, type ColorCluster } from './ColorExtraction';
import { evaluateAesthetic, hasAestheticIdentity, type AestheticAssessment } from './AestheticVisionEngine';
import { logger } from '@/utils/logger';

export type ComplianceViolationType = 'color' | 'typography' | 'logo' | 'safe-zone' | 'aesthetic';

export interface ComplianceViolation {
    type: ComplianceViolationType;
    severity: 'error' | 'warning';
    detail: string;
    evidence?: {
        box?: Box2D;
        foundHex?: string;
        nearestBrandHex?: string;
        deltaE?: number;
    };
}

export interface BrandComplianceReport {
    assetId: string;
    assetUrl: string;
    passed: boolean;
    /** 0–100: 100 − 25 per error − 10 per warning, clamped. */
    score: number;
    violations: ComplianceViolation[];
    engine: 'pixel' | 'vision' | 'hybrid';
    brandKitVersion: string;
    scannedAt: number;
}

export interface ComplianceConfig {
    colorToleranceDeltaE: number;
    /** Dominant clusters below this coverage percent are ignored. */
    colorCoverageMinPct: number;
    requireLogo: boolean;
    /** Logo center must sit within this percent margin of the frame edges. */
    logoSafeZonePct: number;
    passScore: number;
    /** Run the Gemini aesthetic-identity check when the brand kit declares one. */
    enableAestheticCheck: boolean;
}

export const DEFAULT_COMPLIANCE_CONFIG: ComplianceConfig = {
    colorToleranceDeltaE: 12,
    colorCoverageMinPct: 8,
    requireLogo: false,
    logoSafeZonePct: 5,
    passScore: 85,
    enableAestheticCheck: true,
};

/** Box2D values are normalized 0..1 across the asset. */
export interface ComplianceVisionProbe {
    detectLogo(assetUrl: string): Promise<Box2D | null>;
}

export interface ScanDeps {
    vision?: ComplianceVisionProbe;
    extractColors?(dataUrl: string, maxColors?: number): Promise<ColorCluster[]>;
    /** Overrides or disables (returns null) the default aesthetic vision engine. */
    aesthetic?(assetUrl: string, brandKit: BrandKit): Promise<AestheticAssessment | null>;
    /** Stable identity of the scanned history item, when the caller has one. */
    assetId?: string;
}

export function mergeConfig(partial?: Partial<ComplianceConfig>): ComplianceConfig {
    return { ...DEFAULT_COMPLIANCE_CONFIG, ...partial };
}

const ERROR_PENALTY = 25;
const WARNING_PENALTY = 10;

/**
 * Default vision probe backed by ImageAnalysisService (Gemini vision).
 * Returns null (never throws) when the logo cannot be detected — absence of
 * evidence becomes the caller's rule decision, not a crash.
 */
export function createDefaultVisionProbe(): ComplianceVisionProbe {
    return {
        async detectLogo(assetUrl: string): Promise<Box2D | null> {
            try {
                const { imageAnalysisService } = await import('@/services/image/ImageAnalysisService');
                let base64 = assetUrl;
                if (assetUrl.startsWith('data:')) {
                    const commaIndex = assetUrl.indexOf(',');
                    base64 = commaIndex >= 0 ? assetUrl.slice(commaIndex + 1) : assetUrl;
                } else {
                    const response = await fetch(assetUrl);
                    const buffer = await response.arrayBuffer();
                    let binary = '';
                    const bytes = new Uint8Array(buffer);
                    for (let i = 0; i < bytes.length; i += 1) {
                        binary += String.fromCharCode(bytes[i]!);
                    }
                    base64 = btoa(binary);
                }
                const objects = await imageAnalysisService.detectObjects(
                    base64,
                    'Detect the brand logo mark in this image if one is present. Return the object with label "logo" and its bounding box.'
                );
                const logo = objects.find((o) => o.label.toLowerCase().includes('logo'));
                if (!logo) return null;
                // Detection boxes are normalized 0-1000; the probe contract is 0..1.
                return {
                    ymin: logo.box.ymin / 1000,
                    xmin: logo.box.xmin / 1000,
                    ymax: logo.box.ymax / 1000,
                    xmax: logo.box.xmax / 1000,
                };
            } catch (err) {
                logger.warn('[BrandCompliance] Logo detection failed; treating as not detected.', err);
                return null;
            }
        },
    };
}

function nearestBrandColor(hex: string, palette: string[]): { hex: string; deltaE: number } | null {
    let best: { hex: string; deltaE: number } | null = null;
    const lab = srgbToLab(hex);
    for (const candidate of palette) {
        let candidateLab: [number, number, number];
        try {
            candidateLab = srgbToLab(candidate);
        } catch {
            logger.warn(`[BrandCompliance] Invalid hex in brand palette skipped: ${candidate}`);
            continue;
        }
        const distance = deltaE2000(lab, candidateLab);
        if (!best || distance < best.deltaE) {
            best = { hex: candidate, deltaE: distance };
        }
    }
    return best;
}

function inSafeZone(box: Box2D, marginPct: number): boolean {
    const margin = marginPct / 100;
    const cx = (box.xmin + box.xmax) / 2;
    const cy = (box.ymin + box.ymax) / 2;
    return cx >= margin && cx <= 1 - margin && cy >= margin && cy <= 1 - margin;
}

/**
 * Scan one asset against the Brand Kit with the deterministic pixel engine.
 * Violation order is stable: color → typography → logo → safe-zone → aesthetic.
 */
export async function scanAsset(
    assetUrl: string,
    brandKit: BrandKit,
    config?: Partial<ComplianceConfig>,
    deps?: ScanDeps
): Promise<BrandComplianceReport> {
    const cfg = mergeConfig(config);
    const violations: ComplianceViolation[] = [];

    // --- Color -------------------------------------------------------------
    const palette = (brandKit.colors ?? []).map((c) => c.trim()).filter(Boolean);
    if (palette.length === 0) {
        violations.push({
            type: 'color',
            severity: 'warning',
            detail: 'Brand Kit has no palette defined; color compliance was not evaluated.',
        });
    } else {
        const extract = deps?.extractColors ?? extractDominantColors;
        const clusters = await extract(assetUrl);
        for (const cluster of clusters) {
            const coveragePct = cluster.coverage * 100;
            if (coveragePct < cfg.colorCoverageMinPct) continue;
            const nearest = nearestBrandColor(cluster.hex, palette);
            if (!nearest) continue;
            if (nearest.deltaE > cfg.colorToleranceDeltaE) {
                violations.push({
                    type: 'color',
                    severity: 'error',
                    detail: `Off-palette dominant color ${cluster.hex} (${coveragePct.toFixed(1)}% coverage); nearest brand color ${nearest.hex} (ΔE2000 ${nearest.deltaE.toFixed(1)} > tolerance ${cfg.colorToleranceDeltaE}).`,
                    evidence: {
                        foundHex: cluster.hex,
                        nearestBrandHex: nearest.hex,
                        deltaE: nearest.deltaE,
                    },
                });
            }
        }
    }

    // --- Typography --------------------------------------------------------
    const fonts = (brandKit.fonts ?? '').trim();
    if (fonts) {
        violations.push({
            type: 'typography',
            severity: 'warning',
            detail: `Font usage cannot be verified from raster pixels by this engine. Fonts declared in the Brand Kit: ${fonts}. In-house typography layers are verified exactly by the typography engine (Workstream B).`,
        });
    }

    // --- Logo / safe zone ----------------------------------------------------
    const logoAsset = (brandKit.brandAssets ?? []).find((a) => a.category === 'logo');
    if (cfg.requireLogo) {
        if (!logoAsset) {
            violations.push({
                type: 'logo',
                severity: 'error',
                detail: 'A logo is required, but no Brand Kit asset is categorized as "logo".',
            });
        } else {
            const probe = deps?.vision ?? createDefaultVisionProbe();
            const box = await probe.detectLogo(assetUrl);
            if (!box) {
                violations.push({
                    type: 'logo',
                    severity: 'error',
                    detail: `Required logo (${logoAsset.description || logoAsset.url}) was not detected in the asset.`,
                });
            } else if (!inSafeZone(box, cfg.logoSafeZonePct)) {
                violations.push({
                    type: 'safe-zone',
                    severity: 'error',
                    detail: `Detected logo sits outside the ${cfg.logoSafeZonePct}% safe zone and may be cropped by platform UI.`,
                    evidence: { box },
                });
            }
        }
    }

    // --- Aesthetic identity (vision, Phase D2) -------------------------------
    let aestheticRan = false;
    if (cfg.enableAestheticCheck && hasAestheticIdentity(brandKit)) {
        const assessor = deps?.aesthetic ?? evaluateAesthetic;
        try {
            const assessment = await assessor(assetUrl, brandKit);
            if (assessment) {
                aestheticRan = true;
                for (const v of assessment.violations) {
                    violations.push({ type: 'aesthetic', severity: v.severity, detail: v.detail });
                }
            }
        } catch (err) {
            logger.warn('[BrandCompliance] Aesthetic check failed; degrading to warning.', err);
            violations.push({
                type: 'aesthetic',
                severity: 'warning',
                detail: `Aesthetic identity check could not be evaluated (${err instanceof Error ? err.message : String(err)}); it must be re-run before delivery.`,
            });
            aestheticRan = true;
        }
    }

    const errors = violations.filter((v) => v.severity === 'error').length;
    const warnings = violations.filter((v) => v.severity === 'warning').length;
    const score = Math.max(0, Math.min(100, 100 - errors * ERROR_PENALTY - warnings * WARNING_PENALTY));

    return {
        assetId: deps?.assetId ?? 'unknown',
        assetUrl,
        passed: errors === 0 && score >= cfg.passScore,
        score,
        violations,
        engine: aestheticRan ? 'hybrid' : 'pixel',
        brandKitVersion: 'unversioned',
        scannedAt: Date.now(),
    };
}

export interface DeliveryDecision {
    assetId: string;
    allowed: boolean;
    report: BrandComplianceReport;
    /** Present only when delivery was allowed via DEC-6 override. */
    overrideReason?: string;
}

/**
 * DEC-6 gate: a failing asset ships ONLY via an explicit non-empty override
 * reason. Callers persist `overrideReason` with the asset's record (Workstream H
 * version metadata) — an override that is not recorded is a protocol violation.
 */
export function decideDelivery(report: BrandComplianceReport, override?: { reason: string }): DeliveryDecision {
    const reason = override?.reason.trim();
    const allowed = report.passed || (Boolean(reason) && reason!.length > 0);
    return {
        assetId: report.assetId,
        allowed,
        report,
        ...(allowed && !report.passed ? { overrideReason: reason } : {}),
    };
}
