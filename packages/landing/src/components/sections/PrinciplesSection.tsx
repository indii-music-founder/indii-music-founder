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
    label: 'Replace them, not you',
    hex: '#FF3366',
    title: '100% human-made music only.',
    text: 'AI replaces the administrative overhead, legal paperwork, and middlemen you cannot afford to hire—never the music. Synthetic AI-generated audio is strictly barred from release in our code, while human producers, beatmakers, and sample-based works are pre-registered and protected from automated platform takedowns.',
  },
];

export default function PrinciplesSection() {
  return (
    <section id="principles" data-system-section="principles" className="relative z-20 w-full overflow-hidden border-t border-white/10 bg-black">
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
          <h2 className="max-w-5xl text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-black leading-[1.02] tracking-[-0.045em] text-white">
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
