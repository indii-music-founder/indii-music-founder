import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, ShieldAlert, ShieldCheck, ArrowUpRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DistributorConfig {
  id: string;
  name: string;
  badge: string;
  commissionPct: number; // Royalty commission %
  perReleaseFee: number; // Base fee per release
  yearlyAddonPerRelease: number; // Hidden annual add-ons (Leave a legacy, store maximizers, etc.)
  tosRiskText: string;
  summary: string;
}

const DISTRIBUTORS: DistributorConfig[] = [
  {
    id: 'distrokid',
    name: 'DistroKid',
    badge: 'Micro-Fee Aggregator',
    commissionPct: 0,
    perReleaseFee: 22.99,
    yearlyAddonPerRelease: 49.00, // "Leave a Legacy" $49 + Store Maximizer $7.95/yr + Shazam $0.99/yr
    tosRiskText: 'TOS updates allow third-party data processing & uncompensated model training on uploaded catalog tracks.',
    summary: 'Cheap upfront, but charges mandatory annual add-ons per song ("Leave a Legacy" tax) or deletes your music if subscription lapses.',
  },
  {
    id: 'symphonic',
    name: 'Symphonic',
    badge: 'Commission Aggregator',
    commissionPct: 0.15, // 15% royalty cut
    perReleaseFee: 19.99,
    yearlyAddonPerRelease: 15.00,
    tosRiskText: 'Commission agreement claims 15-20% gross royalty cut & manual approval gates before distribution dispatch.',
    summary: 'Takes a 15% royalty commission cut off all DSP streams while enforcing manual gatekeeper approval queues.',
  },
  {
    id: 'tunecore',
    name: 'TuneCore / CD Baby',
    badge: 'Legacy Annual Tax',
    commissionPct: 0.09, // 9% revenue cut (CD Baby) or recurring annual per-album fee
    perReleaseFee: 29.99,
    yearlyAddonPerRelease: 29.99, // $29.99/album/year forever
    tosRiskText: 'Enforces perpetual annual renewal fees per album; failure to pay results in DSP takedown & loss of stream momentum.',
    summary: 'Requires perpetual yearly maintenance fees for every single album in your catalog or threatens DSP takedown.',
  },
];

export const FounderRoyaltyCalculator: React.FC = () => {
  const [selectedDistributor, setSelectedDistributor] = useState<DistributorConfig>(DISTRIBUTORS[0]);
  const [releaseCount, setReleaseCount] = useState<number>(5); // Default 5 releases in catalog
  const [annualStreams, setAnnualStreams] = useState<number>(5000000); // Default 5M streams
  const [averageCpm] = useState<number>(0.0038); // $0.0038 per stream avg DSP rate

  // Financial Calculations
  const grossRoyalty = annualStreams * averageCpm;
  
  // Legacy Distributor Cost = Commission Cut + Annual Catalog Fees
  const legacyCommissionFee = grossRoyalty * selectedDistributor.commissionPct;
  const legacyCatalogFees = releaseCount * (selectedDistributor.perReleaseFee + selectedDistributor.yearlyAddonPerRelease);
  const totalLegacyCost = legacyCommissionFee + legacyCatalogFees;
  const legacyNetPayout = Math.max(0, grossRoyalty - totalLegacyCost);

  // indii.music Cost = 0% Royalty Cut, $0 Hidden Catalog Fees
  const indiiNetPayout = grossRoyalty;
  const retainedSavings = grossRoyalty - legacyNetPayout;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatStreams = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
    return val.toString();
  };

  return (
    <section className="relative z-10 mx-auto my-20 w-full max-w-[1600px] px-5 md:px-10">
      <div className="specular-card relative overflow-hidden rounded-3xl border border-amber-400/30 p-8 md:p-12 shadow-[0_20px_80px_rgba(0,0,0,0.9)]">
        {/* Background Ambient Radial Glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-amber-500/10 blur-[100px]" />

        <div className="grid gap-10 lg:grid-cols-12">
          {/* Left Column: Distributor Selectors & Inputs */}
          <div className="flex flex-col justify-between lg:col-span-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
                <DollarSign size={12} />
                Distributor Cost & Terms Audit
              </div>

              <h2 className="mt-4 text-3xl font-black text-white md:text-4xl">
                The True Cost of <span className="foil-sheen-text">Legacy Distributors</span>
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Distribution is the last gatekeeper standing. Legacy aggregators lock artists into hidden per-track add-on taxes, 15% royalty cuts, and constantly changing Terms of Service.
              </p>

              {/* Distributor Selector Buttons */}
              <div className="mt-6">
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">Compare Legacy Aggregator</span>
                <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                  {DISTRIBUTORS.map((dist) => (
                    <button
                      key={dist.id}
                      type="button"
                      onClick={() => setSelectedDistributor(dist)}
                      className={`rounded-2xl border p-3.5 text-left font-mono transition-all ${
                        selectedDistributor.id === dist.id
                          ? 'border-amber-400 bg-amber-400/20 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                          : 'border-white/10 bg-black/50 text-white/60 hover:border-white/30'
                      }`}
                    >
                      <div className="text-xs font-black">{dist.name}</div>
                      <div className="mt-1 text-[9px] text-white/40">{dist.badge}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Controls: Catalog Size & Annual Streams */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {/* Catalog Size Slider */}
                <div className="rounded-2xl border border-white/10 bg-black/60 p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">Catalog Releases</span>
                    <span className="font-mono text-base font-black text-amber-400">{releaseCount} Releases</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    step="1"
                    value={releaseCount}
                    onChange={(e) => setReleaseCount(Number(e.target.value))}
                    className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-amber-400"
                  />
                  <div className="mt-1 flex justify-between font-mono text-[9px] text-white/40">
                    <span>1 Single</span>
                    <span>10 Releases</span>
                    <span>25+ Releases</span>
                  </div>
                </div>

                {/* Annual Streams Slider */}
                <div className="rounded-2xl border border-white/10 bg-black/60 p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">Annual DSP Streams</span>
                    <span className="font-mono text-base font-black text-amber-400">{formatStreams(annualStreams)}</span>
                  </div>
                  <input
                    type="range"
                    min="500000"
                    max="50000000"
                    step="500000"
                    value={annualStreams}
                    onChange={(e) => setAnnualStreams(Number(e.target.value))}
                    className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-amber-400"
                  />
                  <div className="mt-1 flex justify-between font-mono text-[9px] text-white/40">
                    <span>500K</span>
                    <span>10M</span>
                    <span>50M+</span>
                  </div>
                </div>
              </div>

              {/* TOS Fine Print Warning Box */}
              <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-950/20 p-5 text-xs">
                <div className="flex items-center gap-2 font-mono font-bold text-red-400">
                  <ShieldAlert size={16} />
                  <span>{selectedDistributor.name} Terms of Service Risk</span>
                </div>
                <p className="mt-2 leading-relaxed text-white/70">
                  {selectedDistributor.tosRiskText}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 text-xs text-white/50">
              <ShieldCheck size={16} className="text-amber-400" />
              <span>indii Direct Pipeline • 100% Data Sovereignty • Zero Unauthorized Training</span>
            </div>
          </div>

          {/* Right Column: Comparative Financial Matrix */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/12 bg-black/80 p-6 md:p-8 lg:col-span-6 shadow-[0_15px_50px_rgba(0,0,0,0.9)]">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="font-mono text-xs uppercase tracking-widest text-white/50">Audit Comparison</span>
                <span className="rounded bg-amber-400/20 px-3 py-1 font-mono text-xs font-bold text-amber-300 border border-amber-400/40">
                  Gross DSP Royalties: {formatCurrency(grossRoyalty)}
                </span>
              </div>

              {/* Comparison Matrix Bars */}
              <div className="mt-6 space-y-6">
                {/* Selected Legacy Distributor Bar */}
                <div className="rounded-xl border border-red-500/30 bg-red-950/15 p-5">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="font-bold text-white/80">{selectedDistributor.name} ({releaseCount} Releases)</span>
                    <span className="font-bold text-red-400">{formatCurrency(legacyNetPayout)}</span>
                  </div>

                  <div className="mt-3 h-3.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-red-500 transition-all duration-500"
                      style={{ width: `${Math.max(5, (legacyNetPayout / grossRoyalty) * 100)}%` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-white/50 border-t border-white/10 pt-2">
                    <div>
                      <span className="text-white/40">Commission Cut:</span>{' '}
                      <strong className="text-red-400">-{formatCurrency(legacyCommissionFee)}</strong>
                    </div>
                    <div>
                      <span className="text-white/40">Hidden Catalog Fees:</span>{' '}
                      <strong className="text-red-400">-{formatCurrency(legacyCatalogFees)}</strong>
                    </div>
                  </div>
                </div>

                {/* indii.music Direct Pipeline Bar */}
                <div className="rounded-xl border border-amber-400/50 bg-amber-950/20 p-5 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="font-bold text-white">indii Direct Pipeline (100% Artist Retained)</span>
                    <span className="font-black text-amber-400 text-sm">{formatCurrency(indiiNetPayout)}</span>
                  </div>

                  <div className="mt-3 h-3.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-500 transition-all duration-500 shadow-[0_0_15px_rgba(245,158,11,0.8)]"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-amber-300 border-t border-amber-400/20 pt-2">
                    <div>
                      <span className="text-white/50">Royalty Cut:</span> <strong>$0 (0%)</strong>
                    </div>
                    <div>
                      <span className="text-white/50">Hidden Catalog Tax:</span> <strong>$0</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Retained Money Callout */}
              <div className="mt-6 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-950/40 to-black p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                      Total Money Retained vs {selectedDistributor.name}
                    </span>
                    <div className="mt-1 text-3xl font-black text-white md:text-4xl">
                      +{formatCurrency(retainedSavings)}
                    </div>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/20 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                    <CheckCircle2 size={28} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-white/70">
                  By connecting directly to the distribution pipeline with indii, you keep <strong className="text-amber-300">{formatCurrency(retainedSavings)}</strong> in your pocket instead of paying aggregator taxes and commission cuts.
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                100% Catalog Sovereignty Included
              </span>
              <a
                href="#founder-access"
                className="group inline-flex items-center gap-2 font-mono text-xs font-bold text-amber-400 hover:text-amber-300"
              >
                Bypass Aggregators
                <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
