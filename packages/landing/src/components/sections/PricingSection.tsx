'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { getStudioUrl } from '../../lib/auth';

interface PricingSectionProps {
  onPlanSelect: (plan: string) => void;
}

type BillingCycle = 'monthly' | 'quarterly' | 'six-month' | 'annual';

const billingCycles: Array<{
  id: BillingCycle;
  label: string;
  months: number;
  discount: number;
}> = [
  { id: 'monthly', label: 'Monthly', months: 1, discount: 0 },
  { id: 'quarterly', label: 'Quarterly', months: 3, discount: 0.05 },
  { id: 'six-month', label: 'Six-month', months: 6, discount: 0.1 },
  { id: 'annual', label: 'Annual', months: 12, discount: 0.2 },
];

const plans = [
  {
    name: 'Free',
    monthlyPrice: 0,
    accentHex: '#00BCD4',
    audience: 'See how the connected creative workflow works with one bounded guided experience.',
    includes: ['Verified email account', 'Guided mini-campaign experience', 'Images and short clips without forced branding'],
    cta: 'See how indii.music works',
    href: '#studio-preview',
  },
  {
    name: 'Start',
    monthlyPrice: 22,
    accentHex: '#2196F3',
    audience: 'For an artist beginning to organize and operate the business behind the music.',
    includes: ['Core release workspace', 'Planning and project records', 'Capacity for an emerging artist'],
    cta: 'Choose Start',
    href: '#waitlist',
  },
  {
    name: 'Build',
    monthlyPrice: 55,
    accentHex: '#FFB800',
    audience: 'For an artist actively releasing music and building repeatable operations.',
    includes: ['Everything needed for active releases', 'More connected workflows', 'More working capacity'],
    cta: 'Choose Build',
    href: '#waitlist',
    featured: true,
  },
  {
    name: 'Scale',
    monthlyPrice: 110,
    accentHex: '#9C27B0',
    audience: 'For an artist with an active career, larger workload, and music income.',
    includes: ['Broader operating capability', 'Higher working capacity', 'Support for a larger release load'],
    cta: 'Choose Scale',
    href: '#waitlist',
  },
];

export default function PricingSection({ onPlanSelect }: PricingSectionProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const selectedCycle = billingCycles.find((cycle) => cycle.id === billingCycle) ?? billingCycles[0];

  const getDisplayedPrice = (monthlyPrice: number) => {
    if (monthlyPrice === 0) return { total: '$0', cadence: 'to begin', equivalent: null };
    const total = Math.round(monthlyPrice * selectedCycle.months * (1 - selectedCycle.discount));
    const monthlyEquivalent = Math.round(total / selectedCycle.months);
    if (selectedCycle.id === 'monthly') {
      return { total: `$${total}`, cadence: 'charged monthly', equivalent: null };
    }
    return {
      total: `$${total}`,
      cadence: `charged ${selectedCycle.label.toLowerCase()}`,
      equivalent: `about $${monthlyEquivalent}/month`,
    };
  };

  return (
    <section id="pricing" data-system-section="pricing" className="relative z-20 w-full overflow-hidden border-t border-white/10 bg-[#0E0B08]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(245,158,11,0.14),transparent_42%)]" />
      <div className="relative mx-auto max-w-[1500px] px-5 py-28 md:px-10 md:py-40">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-400">Founding Artist Beta pricing</div>
          <h2 className="mt-6 text-5xl font-black leading-[0.95] tracking-[-0.055em] text-white sm:text-6xl md:text-8xl">
            Choose the stage that fits
            <span className="block text-amber-400 [text-shadow:0_0_35px_rgba(255,184,0,0.4)]">your career now.</span>
          </h2>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-white/60">
            Start with a complete plan for where you are. Add capacity when a project needs it, or move up when your career consistently needs more.
          </p>
          <p className="mx-auto mt-4 max-w-2xl font-mono text-[9px] uppercase leading-relaxed tracking-[0.16em] text-amber-300/90">
            Beta access is invitation-based. These cards describe the intended beta packaging; checkout remains closed until plan entitlements are verified.
          </p>
          <a
            href={getStudioUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-white"
          >
            Log in
          </a>
        </motion.div>
        <div className="mx-auto mt-10 max-w-3xl">
          <div className="mb-3 text-center font-mono text-[9px] uppercase tracking-[0.22em] text-white/40">Choose your billing rhythm</div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-amber-400/25 bg-[#14100C]/90 p-2 shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:grid-cols-4" role="group" aria-label="Billing schedule">
            {billingCycles.map((cycle) => (
              <button
                key={cycle.id}
                type="button"
                aria-pressed={billingCycle === cycle.id}
                onClick={() => setBillingCycle(cycle.id)}
                className={`rounded-xl px-3 py-3 text-xs font-bold transition-all ${billingCycle === cycle.id ? 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] text-black shadow-[0_0_16px_rgba(255,184,0,0.4)]' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'}`}
              >
                <span className="block">{cycle.label}</span>
                <span className={`mt-1 block font-mono text-[8px] uppercase tracking-[0.12em] ${billingCycle === cycle.id ? 'text-black/75 font-bold' : 'text-amber-400'}`}>
                  {cycle.discount ? `${Math.round(cycle.discount * 100)}% savings` : 'Standard price'}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, index) => {
            const displayedPrice = getDisplayedPrice(plan.monthlyPrice);
            return (
            <motion.article
              key={plan.name}
              data-plan={plan.name.toLowerCase()}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-70px' }}
              transition={{ delay: index * 0.07 }}
              className={`relative flex flex-col overflow-hidden rounded-2xl border p-6 md:p-7 backdrop-blur-xl transition-all duration-300 ${
                plan.featured
                  ? 'border-[#FFB800]/70 bg-gradient-to-b from-[#221A0C]/95 via-[#1A1408]/90 to-[#100C05] shadow-[0_25px_65px_rgba(255,184,0,0.25)] ring-1 ring-[#FFB800]/40 scale-[1.03]'
                  : 'border-white/15 bg-gradient-to-b from-[#18130E]/90 via-[#120E0A]/85 to-[#0A0806] shadow-[0_15px_40px_rgba(0,0,0,0.7)] hover:border-white/30 hover:scale-[1.01]'
              }`}
              style={
                !plan.featured
                  ? {
                      borderColor: `${plan.accentHex}45`,
                      boxShadow: `0 12px 35px -5px ${plan.accentHex}20`,
                    }
                  : {}
              }
            >
              <div
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{ background: `linear-gradient(90deg, transparent 0%, ${plan.accentHex} 50%, transparent 100%)` }}
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: plan.accentHex, boxShadow: `0 0 10px ${plan.accentHex}` }} />
                  <h3 className="text-2xl font-black tracking-[-0.03em] text-white">{plan.name}</h3>
                </div>
                {plan.featured && (
                  <span className="rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] px-3 py-1 font-mono text-[8px] font-black uppercase tracking-[0.16em] text-black shadow-[0_0_15px_rgba(255,184,0,0.5)]">
                    Active artist
                  </span>
                )}
              </div>
              <div className="mt-7 flex items-end gap-2" aria-live="polite">
                <span className="text-5xl font-black tracking-[-0.055em] text-white [text-shadow:0_0_20px_rgba(255,255,255,0.15)]">{displayedPrice.total}</span>
                <span className="pb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">{displayedPrice.cadence}</span>
              </div>
              {displayedPrice.equivalent && <div className="mt-2 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#FFB800]">{displayedPrice.equivalent}</div>}
              <p className="mt-5 min-h-[78px] text-sm leading-relaxed text-white/70">{plan.audience}</p>
              <div className="mt-6 flex-1 border-t border-white/10 pt-4">
                {plan.includes.map((item) => (
                  <div key={item} className="flex gap-3 border-b border-white/8 py-3 text-xs leading-relaxed text-white/85">
                    <Check size={14} className="mt-0.5 shrink-0" style={{ color: plan.accentHex, filter: `drop-shadow(0 0 6px ${plan.accentHex})` }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <a
                href={plan.href}
                onClick={() => onPlanSelect(plan.name)}
                className={`group mt-7 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-xs font-black transition-all hover:scale-[1.02] ${
                  plan.featured
                    ? 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] text-black shadow-[0_0_30px_rgba(255,184,0,0.5)] hover:shadow-[0_0_40px_rgba(255,184,0,0.7)]'
                    : 'bg-white text-black hover:bg-[#FFB800] hover:shadow-[0_0_20px_rgba(255,184,0,0.4)]'
                }`}
              >
                {plan.cta}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </a>
            </motion.article>
            );
          })}
        </div>
        <div className="mt-8 grid gap-5 rounded-2xl border border-white/10 bg-black/55 p-6 md:grid-cols-[1fr_1.4fr] md:p-8">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-amber-400">Choose your billing rhythm</div>
            <p className="mt-3 text-xl font-bold tracking-tight text-white">Monthly, quarterly, six-month, or annual.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Quarterly', 'About 5% less'],
              ['Six-month', 'About 10% less'],
              ['Annual', 'About 20% less'],
            ].map(([period, discount]) => (
              <div key={period} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-bold text-white">{period}</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-amber-400">{discount}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 text-xs leading-relaxed text-white/40 md:flex-row md:items-start md:justify-between">
          <p className="max-w-2xl">
            These are introductory beta prices and may change after real operating costs are measured. Select a billing rhythm above to see the total charge
            and approximate monthly equivalent now.
          </p>
          <p className="max-w-lg md:text-right">
            Need to finish more work? One-off units, project packs, and reusable capacity packs are planned. Purchased extra capacity will not expire, and an
            upgrade will remain your choice.
          </p>
        </div>
      </div>
    </section>
  );
}
