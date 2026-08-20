/**
 * Adaptive quality system for the indii.music system experience.
 *
 * Tiers:
 *  - HIGH    Full experience: bloom + vignette, high node/edge detail, dpr <= 2, audio-reactive.
 *  - MEDIUM  Reduced detail: no postprocessing, dpr <= 1.5, fewer edge segments.
 *  - LOW     Minimal: dpr 1, sparse detail, no audio analysis, no hub glyph.
 *  - FALLBACK No canvas at all — the DOM background (stars/grid/glow) carries the page.
 *
 * This module is intentionally THREE-free so it can be imported from the main
 * bundle without pulling WebGL code into the critical path.
 */

export type QualityTier = 'FALLBACK' | 'LOW' | 'MEDIUM' | 'HIGH';

export const TIER_ORDER: QualityTier[] = ['FALLBACK', 'LOW', 'MEDIUM', 'HIGH'];

export function tierRank(tier: QualityTier): number {
  return TIER_ORDER.indexOf(tier);
}

export interface QualityProfile {
  tier: QualityTier;
  dprMax: number;
  bloom: boolean;
  vignette: boolean;
  edgeSegments: number;
  audioReactive: boolean;
  hubGlyph: boolean;
  heroEq: boolean;
  nodeDrift: boolean;
  pointerParallax: boolean;
  /** 0..1 global brightness multiplier applied to the network materials. */
  brightness: number;
}

export function profileForTier(tier: QualityTier): QualityProfile {
  switch (tier) {
    case 'FALLBACK':
      return {
        tier,
        dprMax: 1,
        bloom: false,
        vignette: false,
        edgeSegments: 12,
        audioReactive: false,
        hubGlyph: false,
        heroEq: false,
        nodeDrift: false,
        pointerParallax: false,
        brightness: 0,
      };
    case 'LOW':
      return {
        tier,
        dprMax: 1,
        bloom: false,
        vignette: false,
        edgeSegments: 16,
        audioReactive: false,
        hubGlyph: false,
        heroEq: false,
        nodeDrift: true,
        pointerParallax: false,
        brightness: 0.7,
      };
    case 'MEDIUM':
      return {
        tier,
        dprMax: 1.5,
        bloom: false,
        vignette: false,
        edgeSegments: 28,
        audioReactive: true,
        hubGlyph: true,
        heroEq: true,
        nodeDrift: true,
        pointerParallax: true,
        brightness: 0.85,
      };
    case 'HIGH':
      return {
        tier,
        dprMax: 2,
        bloom: true,
        vignette: true,
        edgeSegments: 40,
        audioReactive: true,
        hubGlyph: true,
        heroEq: true,
        nodeDrift: true,
        pointerParallax: true,
        brightness: 1,
      };
  }
}

export interface DetectionInputs {
  prefersReducedMotion: boolean;
  webgl2Available: boolean;
  coarsePointer: boolean;
  deviceMemory?: number; // Chrome-only, MiB
  hardwareConcurrency?: number;
}

export function detectTier(inputs: DetectionInputs): QualityTier {
  if (inputs.prefersReducedMotion || !inputs.webgl2Available) return 'FALLBACK';

  const memory = inputs.deviceMemory ?? 8;
  const cores = inputs.hardwareConcurrency ?? 8;

  if (inputs.coarsePointer) {
    // Mobile / tablet: protect Safari and low-end Android from memory pressure.
    return memory < 4 || cores <= 4 ? 'LOW' : 'MEDIUM';
  }

  if (memory >= 8 && cores >= 8) return 'HIGH';
  if (memory >= 4 && cores >= 4) return 'MEDIUM';
  return 'LOW';
}

/** Probe WebGL2 without creating a persistent context (cheap, standard). */
export function probeWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    // Release the probe context immediately so it never lingers.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function detectInputs(): DetectionInputs {
  const mqReduced = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  const mqCoarse = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

  return {
    prefersReducedMotion: mqReduced,
    webgl2Available: probeWebGL2(),
    coarsePointer: mqCoarse,
    deviceMemory:
      typeof navigator !== 'undefined'
        ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
        : undefined,
    hardwareConcurrency:
      typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
  };
}

export function detectQualityProfile(): QualityProfile {
  return profileForTier(detectTier(detectInputs()));
}

/** Downgrade helper used by the runtime frame-time monitor (one-way). */
export function stepDown(tier: QualityTier): QualityTier {
  switch (tier) {
    case 'HIGH':
      return 'MEDIUM';
    case 'MEDIUM':
      return 'LOW';
    default:
      return tier;
  }
}
