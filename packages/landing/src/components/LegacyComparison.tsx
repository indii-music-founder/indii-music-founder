'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, ArrowRight, RefreshCw, Zap } from 'lucide-react';

const legacyPillars = [
  {
    title: 'Ownership & Control',
    hex: '#FFB300',
    glow: 'rgba(255, 179, 0, 0.25)',
    legacy: 'Some agreements exchange services or funding for rights, revenue participation, or decision-making control. Terms vary by contract.',
    indii: 'indii is business software, not a label. The artist keeps the rights and remains the decision-maker.',
  },
  {
    title: 'Disconnected Work',
    hex: '#2196F3',
    glow: 'rgba(33, 150, 243, 0.25)',
    legacy: 'Managing releases across 20+ disconnected apps, spreadsheets, and file drops.',
    indii: 'One integrated workspace connecting audio, visual art, metadata, delivery preparation, and finances.',
  },
  {
    title: 'Operating Support',
    hex: '#00FF66',
    glow: 'rgba(0, 255, 102, 0.25)',
    legacy: 'Independent artists often carry release, rights, campaign, and financial work without a shared operating system.',
    indii: 'You set the direction. Connected Intelligence© ensures specialists share context—from brand rules to rights records—without you repeating yourself.',
  },
  {
    title: 'Financial Context',
    hex: '#FFC107',
    glow: 'rgba(255, 193, 7, 0.25)',
    legacy: 'Revenue reports, split information, and project expenses often live in separate systems or spreadsheets.',
    indii: 'Track reported income, expenses, and split records together with the project that created them.',
  },
];

export default function LegacyComparison() {
  return (
    <section id="legacy-shift" data-system-section="legacy" className="relative z-20 w-full border-t border-white/10 bg-black py-28 md:py-40">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,184,0,0.06),transparent_55%)]" />

      <div className="relative mx-auto max-w-[1500px] px-5 md:px-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-white/[0.03] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400 shadow-[0_0_15px_rgba(255,184,0,0.15)]">
            <RefreshCw size={13} />
            The Paradigm Shift
          </div>

          <h2 className="mt-6 text-4xl font-black leading-tight tracking-[-0.05em] text-white sm:text-6xl md:text-7xl">
            The music industry was built <br />
            <span className="text-amber-400 [text-shadow:0_0_30px_rgba(255,184,0,0.35)]">upside-down.</span>
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-white/60 md:text-xl">
            Music-business arrangements are not all the same. Compare what each model handles, what it costs, and how much ownership or control the artist
            keeps.
          </p>

          <p className="mt-3 font-mono text-xs uppercase tracking-wider text-amber-300">Compare the operating model, then read the actual terms.</p>
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
              className="lacquer-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-7 shadow-[0_25px_70px_rgba(0,0,0,0.95)] backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:border-amber-400/50"
            >
              <div
                className="absolute inset-x-0 top-0 h-[1px] specular-line-gold"
              />
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#FFB800]">
                    0{index + 1} / {pillar.title}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FFB800] shadow-[0_0_8px_rgba(255,184,0,0.8)]" />
                </div>

                {/* Legacy Card */}
                <div className="mt-6 rounded-xl border border-white/10 bg-black/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase font-bold text-red-400/90">
                    <ShieldAlert size={12} />A common arrangement
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/70">{pillar.legacy}</p>
                </div>

                {/* indii Way Card */}
                <div className="mt-4 rounded-xl border border-amber-400/25 bg-black/80 p-4 shadow-[inset_0_1px_0_rgba(255,215,0,0.1),0_0_20px_rgba(255,184,0,0.06)]">
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase font-black text-[#FFB800]">
                    <ShieldCheck size={12} />
                    The indii Workspace
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-white/95">{pillar.indii}</p>
                </div>
              </div>

              <div className="mt-6 border-t border-white/10 pt-4 font-mono text-[9px] uppercase tracking-wider text-[#FFB800]/90 flex items-center justify-between">
                <span>Artist-controlled alternative</span>
                <Zap size={12} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom Callout Banner */}
        <div className="lacquer-card-gold relative mt-14 overflow-hidden rounded-2xl p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-12">
          <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold" />
          <h3 className="text-2xl font-black tracking-tight text-white md:text-4xl">You don’t need a label to run a professional career.</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
            You need one unified workspace where delivery preparation, artwork, rights, campaigns, and finances stay connected under your direction.
            <span className="mt-4 block text-lg font-black text-[#FFB800] [text-shadow:0_0_25px_rgba(255,184,0,0.5)] sm:text-xl">
              YOU need <span className="indii-name text-white">indii.music</span>.
            </span>
          </p>
          <a
            href="#studio-preview"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] px-8 py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-[0_0_35px_rgba(255,184,0,0.5)] transition-all hover:scale-[1.03] hover:shadow-[0_0_50px_rgba(255,184,0,0.75)]"
          >
            <span>Explore the Studio Workspace</span>
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
