import { describe, expect, it, vi } from 'vitest';
import { buildDistributionReadiness } from './ReleaseHarnessAdapters';
import type { DdexDeliveryAuthorityEvidence } from './types';
import type { ExtendedGoldenMetadata } from '@/services/metadata/types';

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

const completeMetadata: Partial<ExtendedGoldenMetadata> = {
  trackTitle: 'Night Signal',
  artistName: 'Artist',
  genre: 'Electronic',
  labelName: 'indii.music',
  releaseDate: '2026-09-26',
  territories: ['Worldwide'],
  distributionChannels: ['streaming'],
  dpid: 'PA-DPIDA-TEST',
  isrc: 'USQY12600101',
  upc: '100000000007',
  iswc: 'T-123.456.789-0',
  catalogNumber: 'IND-TEST-2026',
  splits: [{ legalName: 'Artist', role: 'performer', percentage: 100, email: 'artist@example.com' }],
};

const verifiedAuthority: DdexDeliveryAuthorityEvidence = {
  sender: {
    dpid: 'PA-DPIDA-TEST',
    verificationStatus: 'verified',
    credentialStatus: 'active',
    verifiedAt: '2026-08-01T00:00:00.000Z',
    evidenceRef: 'sender-verification-1',
  },
  recipients: {
    spotify: {
      systemIdentifier: 'PADPIDA2011112001R',
      onboardingStatus: 'verified',
      credentialStatus: 'active',
      feedProfileId: 'spotify-feed-v1',
      validationReceipt: {
        receiptId: 'spotify-validation-1',
        status: 'accepted',
        validatedAt: '2026-08-02T00:00:00.000Z',
      },
    },
  },
};

describe('buildDistributionReadiness — delivery authority honesty (ISSUE-1133)', () => {
  it('keeps complete typed metadata and a caller-supplied DPID at metadata_only', () => {
    const readiness = buildDistributionReadiness({
      metadata: completeMetadata,
      selectedStores: ['spotify'],
    });

    expect(readiness.metadataComplete).toBe(true);
    expect(readiness.ddexPackageReady).toBe(false);
    expect(readiness.deliveryAuthorityReady).toBe(false);
    expect(readiness.authorityLevel).toBe('metadata_only');
    expect(readiness.connectedStores).toEqual([]);
    expect(readiness.blockedStores).toEqual(['spotify']);
    expect(readiness.authorityBlockers).toContain('Verified sender DPID and credential evidence is missing.');
    expect(readiness.authorityBlockers).toContain('spotify: verified recipient delivery evidence is missing.');
  });

  it('becomes package_ready only with complete verified sender and recipient evidence', () => {
    const readiness = buildDistributionReadiness({
      metadata: completeMetadata,
      selectedStores: ['spotify'],
      deliveryAuthority: verifiedAuthority,
    });

    expect(readiness.ddexPackageReady).toBe(true);
    expect(readiness.deliveryAuthorityReady).toBe(true);
    expect(readiness.authorityLevel).toBe('package_ready');
    expect(readiness.connectedStores).toEqual(['spotify']);
    expect(readiness.blockedStores).toEqual([]);
    expect(readiness.authorityBlockers).toEqual([]);
  });

  it.each([
    ['recipient credentials', { credentialStatus: 'expired' as const }],
    ['recipient onboarding', { onboardingStatus: 'pending' as const }],
    ['feed profile', { feedProfileId: '' }],
    ['validation receipt', { validationReceipt: undefined }],
  ])('blocks package readiness when %s evidence is absent', (_label, recipientPatch) => {
    const readiness = buildDistributionReadiness({
      metadata: completeMetadata,
      selectedStores: ['spotify'],
      deliveryAuthority: {
        ...verifiedAuthority,
        recipients: {
          spotify: {
            ...verifiedAuthority.recipients!.spotify!,
            ...recipientPatch,
          },
        },
      },
    });

    expect(readiness.ddexPackageReady).toBe(false);
    expect(readiness.blockedStores).toEqual(['spotify']);
    expect(readiness.authorityBlockers.length).toBeGreaterThan(0);
  });
});
