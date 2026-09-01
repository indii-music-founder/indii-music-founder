'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const intakeItems = [
  { text: 'Masters and stems', hex: '#00BCD4' },
  { text: 'Songwriter and split information', hex: '#009688' },
  { text: 'Release metadata', hex: '#2196F3' },
  { text: 'Registrations and rights records', hex: '#455A64' },
  { text: 'Artist profiles and working accounts', hex: '#E91E63' },
  { text: 'Current projects and open decisions', hex: '#FFB800' },
];

export default function OnboardingSection() {
  return (
    <section data-system-section="onboarding" className="relative z-20 w-full overflow-hidden border-t border-white/10 bg-[#050505]">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute right-0 top-1/2 h-[450px] w-[450px] -translate-y-1/2 rounded-full bg-[#00BCD4]/[0.03] blur-[140px]" />
      <div className="mx-auto grid max-w-[1500px] gap-16 px-5 py-28 md:px-10 md:py-40 lg:grid-cols-[1.05fr_0.95fr] lg:gap-24">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
        >
          <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
            Founder onboarding / Project White Glove
          </div>
          <h2 className="max-w-4xl text-5xl font-black leading-[0.93] tracking-[-0.055em] text-white md:text-7xl lg:text-[6.4rem]">
            Start with your real catalog,
            <span className="block text-amber-400">not an empty dashboard.</span>
          </h2>
          <p className="mt-10 max-w-2xl text-lg leading-relaxed text-white/55">
            Founder onboarding begins by mapping what you already have: masters, stems, split information, registrations, release records, artist accounts, and the files holding it all together.
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/55">
            We help organize the starting record, identify gaps, and set up the workspace around your actual operation. We do not pretend missing files or registrations can be recovered by magic.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 25 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          className="border border-white/10 bg-black"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">
            <span>Catalog intake / founder</span>
            <span className="text-amber-400">Guided</span>
          </div>
          {intakeItems.map((item, index) => (
            <div key={item.text} className="flex items-center gap-5 border-b border-white/8 px-6 py-5">
              <span className="font-mono text-[9px] font-bold" style={{ color: item.hex }}>0{index + 1}</span>
              <span className="flex-1 text-sm font-medium text-white/75">{item.text}</span>
              <Check size={13} style={{ color: item.hex }} />
            </div>
          ))}
          <div className="px-6 py-7 text-sm leading-relaxed text-white/50">
            The goal is a reliable starting point—not a promise that every historical gap can be solved automatically.
          </div>
        </motion.div>
      </div>
    </section>
  );
}
