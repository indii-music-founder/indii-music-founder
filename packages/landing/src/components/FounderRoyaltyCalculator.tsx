import React, { useMemo, useState } from 'react';
import { Calculator, ExternalLink, Info, ShieldCheck } from 'lucide-react';

export type DistributorDealType = 'subscription' | 'commission' | 'per-release';

export interface DistributorRateRecord {
  id: string;
  name: string;
  dealType: DistributorDealType;
  badge: string;
  /** Published annual account subscription in USD (0 if none). */
  annualSubscriptionUsd: number;
  /** Published one-time or per-release fee in USD (0 if none). */
  perReleaseFeeUsd: number;
  /** Published recurring annual fee per release in USD (0 if none). */
  annualPerReleaseFeeUsd: number;
  /** Published royalty commission fraction (0.0 to 1.0). */
  commissionRate: number;
  /** Authoritative provider pricing URL. */
  sourceUrl: string;
  /** ISO date (YYYY-MM-DD) when the published values were verified. */
  verifiedAt: string;
  /** Maximum days a pricing record may remain rendered before failing closed. */
  maxAgeDays: number;
  /** Factual, verifiable summary of the published fee model. */
  publishedTermsSummary: string;
}

export interface ComparisonInputs {
  releaseCount: number;
  annualStreams: number;
  assumedRatePerStreamUsd: number;
}

export interface ComparisonResult {
  grossEstimatedRoyaltyUsd: number;
  commissionFeeUsd: number;
  fixedAndReleaseFeesUsd: number;
  totalDistributorCostUsd: number;
  estimatedNetAfterDistributorUsd: number;
}

const MS_PER_DAY = 86_400_000;

/**
 * Published distributor fee models with authoritative source URLs and
 * verification dates (ISSUE-1430). Rows older than `maxAgeDays` or missing
 * source metadata are automatically hidden by `isDistributorRecordFresh`.
 */
export const DISTRIBUTOR_RATE_RECORDS: readonly DistributorRateRecord[] = [
  {
    id: 'distrokid-musician',
    name: 'DistroKid (Musician Plan)',
    dealType: 'subscription',
    badge: 'Annual Subscription',
    annualSubscriptionUsd: 24.99,
    perReleaseFeeUsd: 0,
    annualPerReleaseFeeUsd: 0,
    commissionRate: 0,
    sourceUrl: 'https://distrokid.com/plan/',
    verifiedAt: '2026-11-26',
    maxAgeDays: 180,
    publishedTermsSummary:
      'Published entry plan uses a flat annual subscription with 0% royalty commission; optional add-ons are priced separately and excluded from base-plan math.',
  },
  {
    id: 'cdbaby-standard',
    name: 'CD Baby (Standard)',
    dealType: 'commission',
    badge: 'Per-Release + Commission',
    annualSubscriptionUsd: 0,
    perReleaseFeeUsd: 9.99,
    annualPerReleaseFeeUsd: 0,
    commissionRate: 0.09,
    sourceUrl: 'https://cdbaby.com/music-distribution-pricing/',
    verifiedAt: '2026-11-26',
    maxAgeDays: 180,
    publishedTermsSummary:
      'Published standard model charges a one-time fee per release plus a 9% commission on digital distribution royalties, with no recurring annual renewal fee.',
  },
  {
    id: 'tunecore-rising',
    name: 'TuneCore (Rising Artist)',
    dealType: 'subscription',
    badge: 'Unlimited Annual Plan',
    annualSubscriptionUsd: 22.99,
    perReleaseFeeUsd: 0,
    annualPerReleaseFeeUsd: 0,
    commissionRate: 0,
    sourceUrl: 'https://www.tunecore.com/pricing',
    verifiedAt: '2026-11-26',
    maxAgeDays: 180,
    publishedTermsSummary:
      'Published Rising Artist plan uses an annual subscription covering unlimited releases with 0% digital store royalty commission while the plan remains active.',
  },
];

/**
 * Fail-closed staleness guard (ISSUE-1430): a distributor record may only
 * render when it carries a valid HTTPS source URL, a parseable verification
 * date, non-negative finite numbers, and is within its freshness window.
 */
export function isDistributorRecordFresh(
  record: DistributorRateRecord,
  now: Date = new Date(),
): boolean {
  if (!record.sourceUrl.startsWith('https://')) return false;
  const verifiedMs = Date.parse(`${record.verifiedAt}T00:00:00.000Z`);
  if (!Number.isFinite(verifiedMs)) return false;
  if (!Number.isFinite(record.maxAgeDays) || record.maxAgeDays <= 0) return false;
  const ageDays = (now.getTime() - verifiedMs) / MS_PER_DAY;
  if (ageDays > record.maxAgeDays || ageDays < -2) return false;

  return (
    Number.isFinite(record.annualSubscriptionUsd) && record.annualSubscriptionUsd >= 0 &&
    Number.isFinite(record.perReleaseFeeUsd) && record.perReleaseFeeUsd >= 0 &&
    Number.isFinite(record.annualPerReleaseFeeUsd) && record.annualPerReleaseFeeUsd >= 0 &&
    Number.isFinite(record.commissionRate) && record.commissionRate >= 0 && record.commissionRate <= 1
  );
}

/** Deterministic, reproducible fee calculation separating published fees from stream-rate estimates. */
export function calculateDistributorComparison(
  record: DistributorRateRecord,
  inputs: ComparisonInputs,
): ComparisonResult {
  const releases = Math.max(0, Math.floor(inputs.releaseCount));
  const streams = Math.max(0, inputs.annualStreams);
  const streamRate = Math.max(0, inputs.assumedRatePerStreamUsd);

  const grossEstimatedRoyaltyUsd = streams * streamRate;
  const commissionFeeUsd = grossEstimatedRoyaltyUsd * record.commissionRate;
  const fixedAndReleaseFeesUsd =
    record.annualSubscriptionUsd +
    releases * (record.perReleaseFeeUsd + record.annualPerReleaseFeeUsd);
  const totalDistributorCostUsd = commissionFeeUsd + fixedAndReleaseFeesUsd;
  const estimatedNetAfterDistributorUsd = Math.max(0, grossEstimatedRoyaltyUsd - totalDistributorCostUsd);

  return {
    grossEstimatedRoyaltyUsd,
    commissionFeeUsd,
    fixedAndReleaseFeesUsd,
    totalDistributorCostUsd,
    estimatedNetAfterDistributorUsd,
  };
}

export interface FounderRoyaltyCalculatorProps {
  records?: readonly DistributorRateRecord[];
  now?: Date;
}

export const FounderRoyaltyCalculator: React.FC<FounderRoyaltyCalculatorProps> = ({
  records = DISTRIBUTOR_RATE_RECORDS,
  now,
}) => {
  const referenceDate = useMemo(() => now ?? new Date(), [now]);
  const freshRecords = useMemo(
    () => records.filter((record) => isDistributorRecordFresh(record, referenceDate)),
    [records, referenceDate],
  );

  const [selectedId, setSelectedId] = useState<string>(freshRecords[0]?.id ?? '');
  const [releaseCount, setReleaseCount] = useState<number>(5);
  const [annualStreams, setAnnualStreams] = useState<number>(1_000_000);
  const [assumedRatePerStreamUsd, setAssumedRatePerStreamUsd] = useState<number>(0.0035);

  const selectedDistributor = freshRecords.find((r) => r.id === selectedId) ?? freshRecords[0];

  const comparison = useMemo(() => {
    if (!selectedDistributor) return null;
    return calculateDistributorComparison(selectedDistributor, {
      releaseCount,
      annualStreams,
      assumedRatePerStreamUsd,
    });
  }, [selectedDistributor, releaseCount, annualStreams, assumedRatePerStreamUsd]);

  if (!selectedDistributor || !comparison) {
    return (
      <section className="relative z-10 mx-auto my-20 w-full max-w-[1600px] px-5 md:px-10">
        <div className="rounded-3xl border border-white/15 bg-black/80 p-8 text-sm text-white/70">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-amber-300">
            <Info size={14} />
            <span>Distributor Rate Data Pending Refresh</span>
          </div>
          <p className="mt-2">
            Published distributor fee comparisons are hidden until current, source-verified pricing records are refreshed.
          </p>
        </div>
      </section>
    );
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(val);

  const formatStreams = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toString();
  };

  return (
    <section className="relative z-10 mx-auto my-20 w-full max-w-[1600px] px-5 md:px-10">
      <div className="lacquer-card-gold relative overflow-hidden rounded-3xl p-8 md:p-12 shadow-[0_30px_90px_rgba(0,0,0,0.95)]">
        <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold" />

        <div className="grid gap-10 lg:grid-cols-12">
          {/* Left Column: Deal-Type Selector, Inputs & Assumptions */}
          <div className="flex flex-col justify-between lg:col-span-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                <Calculator size={12} />
                Published Distributor Fee Estimator
              </div>

              <h2 className="mt-4 text-3xl font-black text-white md:text-4xl">
                Compare Published <span className="foil-sheen-text">Distribution Models</span>
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Compare flat annual subscriptions against per-release commission deals using published base rates and your own stream-rate assumptions.
              </p>

              {/* Verified Distributor Selector Buttons */}
              <div className="mt-6">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">
                  Published Provider Deal Models
                </span>
                <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {freshRecords.map((dist) => (
                    <button
                      key={dist.id}
                      type="button"
                      onClick={() => setSelectedId(dist.id)}
                      className={`rounded-2xl border p-3.5 text-left font-mono transition-all ${
                        selectedDistributor.id === dist.id
                          ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                          : 'border-white/10 bg-black/50 text-white/60 hover:border-white/30'
                      }`}
                    >
                      <div className="text-xs font-black">{dist.name}</div>
                      <div className="mt-1 text-[10px] text-white/50">{dist.badge}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable Illustrative Assumptions */}
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="catalog-releases" className="font-mono text-[10px] uppercase tracking-wider text-white/60">
                      New Releases / Yr
                    </label>
                    <span className="font-mono text-sm font-black text-amber-400">{releaseCount}</span>
                  </div>
                  <input
                    id="catalog-releases"
                    type="range"
                    min="1"
                    max="25"
                    step="1"
                    value={releaseCount}
                    aria-valuetext={`${releaseCount} releases`}
                    onChange={(e) => setReleaseCount(Number(e.target.value))}
                    className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-amber-400"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="annual-streams" className="font-mono text-[10px] uppercase tracking-wider text-white/60">
                      Est. Annual Streams
                    </label>
                    <span className="font-mono text-sm font-black text-amber-400">{formatStreams(annualStreams)}</span>
                  </div>
                  <input
                    id="annual-streams"
                    type="range"
                    min="100000"
                    max="25000000"
                    step="100000"
                    value={annualStreams}
                    aria-valuetext={`${formatStreams(annualStreams)} estimated annual streams`}
                    onChange={(e) => setAnnualStreams(Number(e.target.value))}
                    className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-amber-400"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                  <div className="flex items-center justify-between">
                    <label htmlFor="stream-rate" className="font-mono text-[10px] uppercase tracking-wider text-white/60">
                      Est. $/Stream
                    </label>
                    <span className="font-mono text-sm font-black text-amber-400">
                      ${assumedRatePerStreamUsd.toFixed(4)}
                    </span>
                  </div>
                  <input
                    id="stream-rate"
                    type="range"
                    min="0.002"
                    max="0.006"
                    step="0.0005"
                    value={assumedRatePerStreamUsd}
                    aria-valuetext={`$${assumedRatePerStreamUsd.toFixed(4)} assumed per stream`}
                    onChange={(e) => setAssumedRatePerStreamUsd(Number(e.target.value))}
                    className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-amber-400"
                  />
                </div>
              </div>

              {/* Published Source Verification Card */}
              <div className="mt-5 rounded-2xl border border-white/15 bg-black/50 p-5 text-xs">
                <div className="flex items-center justify-between gap-2 font-mono font-bold text-white/90">
                  <span>Published Provider Facts</span>
                  <span className="text-[10px] text-white/50">Verified {selectedDistributor.verifiedAt}</span>
                </div>
                <p className="mt-2 leading-relaxed text-white/70">
                  {selectedDistributor.publishedTermsSummary}
                </p>
                <a
                  href={selectedDistributor.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] text-amber-300 hover:underline"
                >
                  View provider pricing page
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs text-white/60">
              <ShieldCheck size={16} className="shrink-0 text-amber-400" />
              <span>
                Estimates are illustrative only. Actual DSP payouts vary by territory, listener tier, and distributor terms.
              </span>
            </div>
          </div>

          {/* Right Column: Transparent Breakdown */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/12 bg-black/80 p-6 md:p-8 lg:col-span-6">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="font-mono text-xs uppercase tracking-widest text-white/50">
                  Illustrative Annual Breakdown
                </span>
                <span className="rounded border border-amber-400/40 bg-amber-400/15 px-3 py-1 font-mono text-xs font-bold text-amber-300">
                  Est. Gross: {formatCurrency(comparison.grossEstimatedRoyaltyUsd)}
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/15 bg-white/[0.03] p-5">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="font-bold text-white">{selectedDistributor.name}</span>
                    <span className="font-bold text-amber-300">
                      Est. Net: {formatCurrency(comparison.estimatedNetAfterDistributorUsd)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3 font-mono text-[11px] text-white/70">
                    <div>
                      <span className="block text-white/40">Published Commission ({Math.round(selectedDistributor.commissionRate * 100)}%)</span>
                      <strong>-{formatCurrency(comparison.commissionFeeUsd)}</strong>
                    </div>
                    <div>
                      <span className="block text-white/40">Published Base & Release Fees</span>
                      <strong>-{formatCurrency(comparison.fixedAndReleaseFeesUsd)}</strong>
                    </div>
                  </div>
                </div>

                {/* Proven indii Workspace Capabilities (no unproven direct-pipeline claims) */}
                <div className="rounded-xl border border-amber-400/30 bg-amber-950/15 p-5">
                  <div className="font-mono text-xs font-bold text-amber-300">
                    How indii Supports Your Release Business
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/75">
                    indii prepares release metadata, DDEX ERN packages, split sheets, and royalty statement audits in one workspace so your catalog stays organized regardless of which distributor you choose.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-white/10 pt-4 font-mono text-[10px] leading-relaxed text-white/50">
              Assumptions used: {releaseCount} releases/yr, {formatStreams(annualStreams)} streams/yr at ${assumedRatePerStreamUsd.toFixed(4)}/stream. Base plan fees only; optional distributor add-ons and taxes excluded.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
