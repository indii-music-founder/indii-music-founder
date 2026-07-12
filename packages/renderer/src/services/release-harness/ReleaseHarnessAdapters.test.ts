import { describe, expect, it, vi } from 'vitest';
import { buildDistributionReadiness } from './ReleaseHarnessAdapters';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(async () => ({ docs: [] })),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({ db: {} }));
vi.mock('@/services/audio/AudioIntelligenceService', () => ({
  audioIntelligence: {
    analyze: vi.fn(),
  },
}));

/**
 * ISSUE-813: buildDistributionReadiness() previously reported iswcStatus:
 * 'registered' for ANY caller-supplied ISWC string, with zero CISAC/PRO
 * verification — a typed or imported code satisfied release-readiness as
 * if it were officially assigned. This function only ever sees raw
 * metadata (never a confirmed ISWCService work record), so it can never
 * honestly claim 'registered'.
 */
describe('buildDistributionReadiness — iswcStatus honesty (ISSUE-813)', () => {
  it('reports missing when no ISWC is present', () => {
    const readiness = buildDistributionReadiness({ metadata: {} });
    expect(readiness.identifiers.iswcStatus).toBe('missing');
  });

  it('reports draft (unverified claim), never registered, for a caller-supplied ISWC', () => {
    const readiness = buildDistributionReadiness({
      metadata: { iswc: 'T-034.524.680-1' },
    });
    expect(readiness.identifiers.iswcStatus).toBe('draft');
    expect(readiness.identifiers.iswcStatus).not.toBe('registered');
  });

  it('still reports draft even for a malformed ISWC (format warning is separate from status)', () => {
    const readiness = buildDistributionReadiness({
      metadata: { iswc: 'not-a-real-iswc' },
    });
    expect(readiness.identifiers.iswcStatus).toBe('draft');
    expect(readiness.rightsWarnings).toContain('ISWC format is invalid');
  });
});
