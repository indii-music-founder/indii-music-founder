'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

export default function DetroitSection() {
  return (
    <section id="detroit" data-system-section="detroit" className="relative z-20 w-full overflow-hidden border-t border-white/10 bg-[#120E0A]">
      {/* Ambient background glow — Detroit Analog Hardware & Sonic Energy */}
      <div className="pointer-events-none absolute left-[-8rem] top-1/2 h-[550px] w-[550px] -translate-y-1/2 rounded-full bg-[#E91E63]/[0.07] blur-[160px]" />
      <div className="pointer-events-none absolute right-[-8rem] top-1/3 h-[550px] w-[550px] rounded-full bg-[#2196F3]/[0.07] blur-[160px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[700px] rounded-full bg-[#FFB800]/[0.035] blur-[140px]" />

      <div className="mx-auto grid max-w-[1500px] gap-16 px-5 py-28 md:px-10 md:py-40 lg:grid-cols-[0.55fr_1.45fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="flex flex-col justify-between"
        >
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400 shadow-[0_0_15px_rgba(255,184,0,0.15)]">
              <MapPin size={12} />
              Detroit / 42.3314° N
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/50">
              Built locally around the reality of independent work: too much administration, too many disconnected systems, and not enough time left for the music.
            </p>
          </div>
          <div className="mt-14 hidden font-mono text-[9px] uppercase tracking-[0.22em] text-white/30 lg:block">
            New Detroit Music LLC
            <br />
            Founder build / 2026
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="max-w-5xl text-5xl font-black leading-[0.94] tracking-[-0.055em] text-white md:text-7xl lg:text-[7rem]">
            Built in Detroit for your work
            <span className="block text-amber-400">behind the music scene.</span>
          </h2>
          <div className="mt-12 grid gap-8 border-t border-amber-400/20 pt-8 md:grid-cols-2">
            <p className="text-lg leading-relaxed text-white/65">
              indii started with a practical question: what would independent artists need if the departments and gatekeepers around them were tools for their career instead?
            </p>
            <div className="rounded-2xl border border-white/12 bg-[#1A1510]/80 p-7 shadow-[0_15px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <p className="text-lg leading-relaxed text-white/80">
                The answer is not another dashboard full of promises. It is a working place for the files, decisions, business records, creative work, and approvals already surrounding the artist.
              </p>
              <p className="mt-9 flex items-center gap-3 text-sm font-semibold text-white">
                <span className="h-px w-9 bg-gradient-to-r from-[#FFD700] to-[#FFB800]" />
                <span className="wiil-name">wiil</span>, Founder
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
