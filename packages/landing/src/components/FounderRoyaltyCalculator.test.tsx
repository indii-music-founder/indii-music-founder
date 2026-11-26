import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  DISTRIBUTOR_RATE_RECORDS,
  FounderRoyaltyCalculator,
  calculateDistributorComparison,
  isDistributorRecordFresh,
  type DistributorRateRecord,
} from './FounderRoyaltyCalculator';

describe('FounderRoyaltyCalculator (ISSUE-1430)', () => {
  const referenceDate = new Date('2026-11-26T12:00:00.000Z');

  it('produces deterministic, reproducible calculations for subscription and commission deal types', () => {
    const subRecord = DISTRIBUTOR_RATE_RECORDS.find((r) => r.id === 'distrokid-musician')!;
    const subResult = calculateDistributorComparison(subRecord, {
      releaseCount: 5,
      annualStreams: 1_000_000,
      assumedRatePerStreamUsd: 0.0035,
    });
    expect(subResult.grossEstimatedRoyaltyUsd).toBeCloseTo(3500, 6);
    expect(subResult.commissionFeeUsd).toBe(0);
    expect(subResult.fixedAndReleaseFeesUsd).toBeCloseTo(24.99, 6);
    expect(subResult.estimatedNetAfterDistributorUsd).toBeCloseTo(3475.01, 6);

    const commRecord = DISTRIBUTOR_RATE_RECORDS.find((r) => r.id === 'cdbaby-standard')!;
    const commResult = calculateDistributorComparison(commRecord, {
      releaseCount: 4,
      annualStreams: 1_000_000,
      assumedRatePerStreamUsd: 0.004,
    });
    expect(commResult.grossEstimatedRoyaltyUsd).toBeCloseTo(4000, 6);
    expect(commResult.commissionFeeUsd).toBeCloseTo(360, 6);
    expect(commResult.fixedAndReleaseFeesUsd).toBeCloseTo(39.96, 6);
    expect(commResult.estimatedNetAfterDistributorUsd).toBeCloseTo(3600.04, 6);
  });

  it('rejects stale or unverified records via fail-closed freshness guard', () => {
    const staleRecord: DistributorRateRecord = {
      ...DISTRIBUTOR_RATE_RECORDS[0]!,
      verifiedAt: '2025-01-01',
      maxAgeDays: 90,
    };
    const insecureSource: DistributorRateRecord = {
      ...DISTRIBUTOR_RATE_RECORDS[0]!,
      sourceUrl: 'http://insecure.example.com/pricing',
    };

    expect(isDistributorRecordFresh(DISTRIBUTOR_RATE_RECORDS[0]!, referenceDate)).toBe(true);
    expect(isDistributorRecordFresh(staleRecord, referenceDate)).toBe(false);
    expect(isDistributorRecordFresh(insecureSource, referenceDate)).toBe(false);
  });

  it('refuses to render stale records and shows a pending-refresh fallback when all records are stale', () => {
    const staleOnly: DistributorRateRecord[] = DISTRIBUTOR_RATE_RECORDS.map((r) => ({
      ...r,
      verifiedAt: '2024-01-01',
      maxAgeDays: 90,
    }));

    render(<FounderRoyaltyCalculator records={staleOnly} now={referenceDate} />);
    expect(screen.getByText(/Distributor Rate Data Pending Refresh/i)).toBeTruthy();
    expect(screen.queryByText(/DistroKid/i)).toBeNull();
  });

  it('renders source links, verification dates, and transparent assumptions without unverified TOS or direct-pipeline claims', () => {
    const { container } = render(<FounderRoyaltyCalculator now={referenceDate} />);
    const text = container.textContent ?? '';

    expect(text).toContain('Verified 2026-11-26');
    expect(text).toContain('Estimates are illustrative only');
    expect(text).toContain('View provider pricing page');

    // Banned unverified/overbroad claims from ISSUE-1430 must never appear.
    expect(text).not.toMatch(/uncompensated model training/i);
    expect(text).not.toMatch(/Bypass Aggregators/i);
    expect(text).not.toMatch(/indii Direct Pipeline/i);
    expect(text).not.toMatch(/100% Artist Retained/i);
  });
});
