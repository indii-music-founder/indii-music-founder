'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, ArrowRight, RefreshCw, Zap } from 'lucide-react';

const legacyPillars = [
  {
    title: 'Ownership & Control',
    legacy: 'Some agreements exchange services or funding for rights, revenue participation, or decision-making control. Terms vary by contract.',
    indii: 'indii is business software, not a label. The artist keeps the rights and remains the decision-maker.',
  },
  {
    title: 'Disconnected Work',
    legacy: 'Managing releases across 20+ disconnected apps, spreadsheets, and file drops.',
    indii: 'One integrated workspace connecting audio, visual art, metadata, distribution, and finances.',
  },
  {
    title: 'Operating Support',
    legacy: 'Independent artists often carry release, rights, campaign, and financial work without a shared operating system.',
    indii: 'You set the direction. Connected specialists help prepare the relevant work from shared project context.',
  },
  {
    title: 'Financial Context',
    legacy: 'Revenue reports, split information, and project expenses often live in separate systems or spreadsheets.',
    indii: 'Track reported income, expenses, and split records together with the project that created them.',
  },
];

export default function LegacyComparison() {
  return (
    <section id="legacy-shift" data-system-section="legacy" className="relative z-20 w-full border-t border-white/10 bg-[#020202] py-28 md:py-40">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.07),transparent_50%)]" />

      <div className="relative mx-auto max-w-[1500px] px-5 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
            <RefreshCw size={13} />
            The Paradigm Shift
          </div>

          <h2 className="mt-6 text-4xl font-black leading-tight tracking-[-0.05em] text-white sm:text-6xl md:text-7xl">
            The music industry was built <br />
            <span className="text-amber-400">upside-down.</span>
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-white/60 md:text-xl">
            Music-business arrangements are not all the same. Compare what each model handles, what it costs, and how much ownership or control the artist keeps.
          </p>

          <p className="mt-3 font-mono text-xs uppercase tracking-wider text-amber-300">
            Compare the operating model, then read the actual terms.
          </p>
        </motion.div>

        {/* Comparison Grid */}
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {legacyPillars.map((pillar, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#060606] p-7 transition-all hover:border-amber-400/40"
            >
              <div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400">
                  0{index + 1} / {pillar.title}
                </div>

                {/* Legacy Card */}
                <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase font-bold text-red-400">
                    <ShieldAlert size={12} />
                    A common arrangement
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/55">
                    {pillar.legacy}
                  </p>
                </div>

                {/* indii Way Card */}
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase font-bold text-emerald-400">
                    <ShieldCheck size={12} />
                    The indii Workspace
                  </div>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-white/90">
                    {pillar.indii}
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4 font-mono text-[9px] uppercase tracking-wider text-amber-400 flex items-center justify-between">
                <span>Artist-controlled alternative</span>
                <Zap size={12} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom Callout Banner */}
        <div className="mt-14 rounded-2xl border border-amber-400/30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-950/40 via-black to-black p-8 text-center sm:p-12">
          <h3 className="text-2xl font-black tracking-tight text-white md:text-4xl">
            You don’t need a label to run a professional career.
          </h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
            You just need one unified workspace where distribution, artwork, rights, campaigns, and finances work together under your direct command.
            <span className="mt-4 block text-lg font-black text-amber-400 sm:text-xl">
              YOU need <span className="indii-name">indii.music</span>.
            </span>
          </p>
          <a
            href="#studio-preview"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-amber-400 px-8 py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-transform hover:scale-[1.03]"
          >
            <span>Explore the Studio Workspace</span>
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
