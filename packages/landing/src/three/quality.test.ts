import { describe, expect, it } from 'vitest';
import {
  detectTier,
  detectQualityProfile,
  profileForTier,
  stepDown,
  tierRank,
} from './quality';

describe('quality tier detection', () => {
  it('falls back when the visitor prefers reduced motion', () => {
    expect(
      detectTier({
        prefersReducedMotion: true,
        webgl2Available: true,
        coarsePointer: false,
        deviceMemory: 16,
        hardwareConcurrency: 16,
      }),
    ).toBe('FALLBACK');
  });

  it('falls back when WebGL2 is unavailable', () => {
    expect(
      detectTier({
        prefersReducedMotion: false,
        webgl2Available: false,
        coarsePointer: false,
        deviceMemory: 16,
        hardwareConcurrency: 16,
      }),
    ).toBe('FALLBACK');
  });

  it('gives high-end desktops the full experience', () => {
    expect(
      detectTier({
        prefersReducedMotion: false,
        webgl2Available: true,
        coarsePointer: false,
        deviceMemory: 8,
        hardwareConcurrency: 8,
      }),
    ).toBe('HIGH');
  });

  it('gives ordinary laptops the medium experience', () => {
    expect(
      detectTier({
        prefersReducedMotion: false,
        webgl2Available: true,
        coarsePointer: false,
        deviceMemory: 4,
        hardwareConcurrency: 4,
      }),
    ).toBe('MEDIUM');
  });

  it('keeps weak desktops on low', () => {
    expect(
      detectTier({
        prefersReducedMotion: false,
        webgl2Available: true,
        coarsePointer: false,
        deviceMemory: 2,
        hardwareConcurrency: 2,
      }),
    ).toBe('LOW');
  });

  it('treats mobile conservatively', () => {
    expect(
      detectTier({
        prefersReducedMotion: false,
        webgl2Available: true,
        coarsePointer: true,
        deviceMemory: 8,
        hardwareConcurrency: 8,
      }),
    ).toBe('MEDIUM');
    expect(
      detectTier({
        prefersReducedMotion: false,
        webgl2Available: true,
        coarsePointer: true,
        deviceMemory: 3,
        hardwareConcurrency: 4,
      }),
    ).toBe('LOW');
  });
});

describe('quality profiles', () => {
  it('high tier enables bloom, audio reactivity and full detail', () => {
    const p = profileForTier('HIGH');
    expect(p.bloom).toBe(true);
    expect(p.audioReactive).toBe(true);
    expect(p.hubGlyph).toBe(true);
    expect(p.heroEq).toBe(true);
    expect(p.dprMax).toBe(2);
  });

  it('medium tier drops postprocessing but keeps the network', () => {
    const p = profileForTier('MEDIUM');
    expect(p.bloom).toBe(false);
    expect(p.vignette).toBe(false);
    expect(p.hubGlyph).toBe(true);
    expect(p.dprMax).toBe(1.5);
  });

  it('low tier keeps a minimal but alive network', () => {
    const p = profileForTier('LOW');
    expect(p.bloom).toBe(false);
    expect(p.audioReactive).toBe(false);
    expect(p.heroEq).toBe(false);
    expect(p.pointerParallax).toBe(false);
    expect(p.brightness).toBeLessThan(1);
  });

  it('fallback is fully inert', () => {
    const p = profileForTier('FALLBACK');
    expect(p.brightness).toBe(0);
    expect(p.nodeDrift).toBe(false);
  });
});

describe('runtime stepping', () => {
  it('steps down one tier at a time and never below LOW', () => {
    expect(stepDown('HIGH')).toBe('MEDIUM');
    expect(stepDown('MEDIUM')).toBe('LOW');
    expect(stepDown('LOW')).toBe('LOW');
    expect(tierRank('LOW')).toBeLessThan(tierRank('HIGH'));
  });
});

describe('detectQualityProfile integration', () => {
  it('returns a valid profile without throwing in any environment', () => {
    const profile = detectQualityProfile();
    expect(['FALLBACK', 'LOW', 'MEDIUM', 'HIGH']).toContain(profile.tier);
    expect(profile.dprMax).toBeGreaterThan(0);
  });
});
