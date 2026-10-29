import { describe, expect, it } from 'vitest';
import { RightsNavigationSchema } from './contracts.js';

describe('rights worker navigation wire contract', () => {
  const packet = { type: 'navigation', navigationGeneration: 0, viewportVersion: 1 };

  it('preserves the generation fence consumed by the renderer', () => {
    expect(RightsNavigationSchema.parse(packet)).toEqual(packet);
  });

  it('rejects malformed counters and extra worker-controlled properties', () => {
    for (const invalid of [
      { ...packet, navigationGeneration: -1 },
      { ...packet, navigationGeneration: 0.5 },
      { ...packet, navigationGeneration: Number.MAX_SAFE_INTEGER + 1 },
      { ...packet, viewportVersion: '1' },
      { ...packet, viewportVersion: Infinity },
      { ...packet, url: 'javascript:alert(1)' },
      { type: 'navigation', url: 'https://example.com' },
    ]) expect(RightsNavigationSchema.safeParse(invalid).success).toBe(false);
  });
});
