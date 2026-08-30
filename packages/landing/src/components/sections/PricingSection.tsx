'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

interface PricingSectionProps {
  onPlanSelect: (plan: string) => void;
}

const plans = [
  {
    name: 'Free',
    price: '$0',
    audience: 'See how the connected creative workflow works with one bounded guided experience.',
    includes: ['Verified email account', 'Guided mini-campaign experience', 'Images and short clips without forced branding'],
    cta: 'See how indii.music works',
    href: '#studio-preview',
  },
  {
    name: 'Start',
    price: '$22',
    audience: 'For an artist beginning to organize and operate the business behind the music.',
    includes: ['Core release workspace', 'Planning and project records', 'Capacity for an emerging artist'],
    cta: 'Choose Start',
    href: '#waitlist',
  },
  {
    name: 'Build',
    price: '$55',
    audience: 'For an artist actively releasing music and building repeatable operations.',
    includes: ['Everything needed for active releases', 'More connected workflows', 'More working capacity'],
    cta: 'Choose Build',
    href: '#waitlist',
    featured: true,
  },
  {
    name: 'Scale',
    price: '$110',
    audience: 'For an artist with an active career, larger workload, and music income.',
    includes: ['Broader operating capability', 'Higher working capacity', 'Support for a larger release load'],
    cta: 'Choose Scale',
    href: '#waitlist',
  },
];

export default function PricingSection({ onPlanSelect }: PricingSectionProps) {
  return (
    <section id="pricing" data-system-section="pricing" className="relative z-20 w-full border-t border-white/10 bg-[#030303]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(245,158,11,0.09),transparent_40%)]" />
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
            <span className="block text-amber-400">your career now.</span>
          </h2>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-white/55">
            Start with a complete plan for where you are. Add capacity when a project needs it, or move up when your career consistently needs more.
          </p>
          <p className="mx-auto mt-4 max-w-2xl font-mono text-[9px] uppercase leading-relaxed tracking-[0.16em] text-amber-300/80">
            Beta access is invitation-based. These cards describe the intended beta packaging; checkout remains closed until plan entitlements are verified.
          </p>
        </motion.div>
        <div className="mt-16 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, index) => (
            <motion.article
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-70px' }}
              transition={{ delay: index * 0.07 }}
              className={`flex flex-col rounded-2xl border p-6 md:p-7 ${plan.featured ? 'border-amber-400/60 bg-amber-400/[0.07]' : 'border-white/10 bg-black/55'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-black tracking-[-0.03em] text-white">{plan.name}</h3>
                {plan.featured && (
                  <span className="rounded-full bg-amber-400 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[0.16em] text-black">
                    Active artist
                  </span>
                )}
              </div>
              <div className="mt-7 flex items-end gap-2">
                <span className="text-5xl font-black tracking-[-0.055em] text-white">{plan.price}</span>
                <span className="pb-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">{plan.name === 'Free' ? 'to begin' : 'per month'}</span>
              </div>
              <p className="mt-5 min-h-[78px] text-sm leading-relaxed text-white/55">{plan.audience}</p>
              <div className="mt-6 flex-1 border-t border-white/10 pt-4">
                {plan.includes.map((item) => (
                  <div key={item} className="flex gap-3 border-b border-white/8 py-3 text-xs leading-relaxed text-white/65">
                    <Check size={13} className="mt-0.5 shrink-0 text-amber-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <a
                href={plan.href}
                onClick={() => onPlanSelect(plan.name)}
                className={`group mt-7 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-xs font-black transition-transform hover:scale-[1.02] ${plan.featured ? 'bg-amber-400 text-black' : 'bg-white text-black'}`}
              >
                {plan.cta}
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </a>
            </motion.article>
          ))}
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
            These are introductory beta prices and may change after real operating costs are measured. Longer-period totals and monthly equivalents will be
            shown before payment.
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
