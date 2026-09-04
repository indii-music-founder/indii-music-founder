'use client';

import React from 'react';
import { motion } from 'framer-motion';

const operatingPrinciples = [
  {
    number: '01',
    label: 'Bring the project',
    hex: '#00BCD4',
    title: 'Start with the work you already have.',
    text: 'Audio, notes, files, release information, and business records belong to the same project—not a scavenger hunt across disconnected apps.',
  },
  {
    number: '02',
    label: 'Name the outcome',
    hex: '#FFB800',
    title: 'Ask for the result in plain language.',
    text: 'You should not need to understand the product architecture before you can move your release, catalog, campaign, or tour forward.',
  },
  {
    number: '03',
    label: 'Review the plan',
    hex: '#2196F3',
    title: 'See what will happen before it happens.',
    text: 'The work is divided into visible steps. Proposed high-impact actions and important project decisions remain available for review.',
  },
  {
    number: '04',
    label: 'Connected Intelligence©',
    hex: '#00FF66',
    title: 'Let the next move begin with context.',
    text: 'Approved assets and decisions return to the project so every department can work from the same facts without making you repeat yourself. Connected Intelligence© ensures that what your brand manager defines, your art department executes.',
  },
];

export default function PrinciplesSection() {
  return (
    <section data-system-section="principles" className="relative z-20 w-full overflow-hidden border-t border-white/10 bg-black">
      <div className="pointer-events-none absolute right-0 top-1/2 h-[450px] w-[450px] -translate-y-1/2 rounded-full bg-amber-500/[0.04] blur-[160px]" />
      <div className="mx-auto max-w-[1500px] px-5 py-28 md:px-10 md:py-40">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="grid gap-12 border-b border-white/10 pb-16 lg:grid-cols-[0.65fr_1.35fr]"
        >
          <div>
            <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-amber-400">
              How the work moves
            </div>
          </div>
          <h2 className="max-w-5xl text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-6xl md:text-8xl lg:text-[7.5rem]">
            You stay the artist.
            <span className="block text-amber-400 [text-shadow:0_0_35px_rgba(255,184,0,0.4)]">You also stay in control.</span>
          </h2>
        </motion.div>

        <div className="mt-6 border-t border-white/10">
          {operatingPrinciples.map((principle, index) => (
            <motion.article
              key={principle.number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-70px' }}
              transition={{ duration: 0.65, delay: index * 0.05 }}
              className="grid gap-6 border-b border-white/10 py-10 transition-all hover:bg-white/[0.02] md:grid-cols-[0.18fr_0.42fr_1fr] md:gap-10 md:py-14"
            >
              <div className="flex items-start">
                <span
                  className="inline-flex h-9 w-14 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] font-mono text-[11px] font-black tracking-[0.18em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  {principle.number}
                </span>
              </div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#FFB800]">
                {principle.label}
              </div>
              <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <h3 className="text-2xl font-black leading-tight tracking-[-0.03em] text-white md:text-3xl">
                  {principle.title}
                </h3>
                <p className="max-w-xl leading-relaxed text-white/70">{principle.text}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
