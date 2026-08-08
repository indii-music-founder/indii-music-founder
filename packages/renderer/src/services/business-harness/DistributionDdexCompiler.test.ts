import { describe, expect, it } from 'vitest';
import { DistributionDdexCompiler } from './DistributionDdexCompiler';
import type { DistributionDdexInput } from './DistributionDdexCompiler';

const metadata: DistributionDdexInput['metadata'] = {
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

describe('DistributionDdexCompiler', () => {
  it('does not award 100% readiness for typed metadata, identifiers, a DPID, and stores alone', () => {
    const run = new DistributionDdexCompiler().compile({
      metadata,
      selectedStores: ['spotify'],
    }, { userId: 'artist-1', projectId: 'project-1' });

    expect(run.scores[0]?.value).toBe(70);
    expect(run.output.readiness.authorityLevel).toBe('metadata_only');
    expect(run.findings.some(finding => finding.title === 'Delivery authority not verified')).toBe(true);
    expect(run.recommendations[0]?.nextAction).not.toMatch(/Ask user for delivery approval/i);
  });

  it('awards package readiness only when sender and recipient evidence is verified', () => {
    const run = new DistributionDdexCompiler().compile({
      metadata,
      selectedStores: ['spotify'],
      deliveryAuthority: {
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
      },
    }, { userId: 'artist-1', projectId: 'project-1' });

    expect(run.scores[0]?.value).toBe(100);
    expect(run.output.readiness.authorityLevel).toBe('package_ready');
    expect(run.evidenceRefs.map(ref => ref.id)).toEqual([
      'sender-verification-1',
      'spotify-validation-1',
    ]);
    expect(run.assumptions).toContain('DDEX delivery is never authorized by this harness. It only prepares readiness.');
  });
});
