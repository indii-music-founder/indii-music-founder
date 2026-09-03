'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

export default function DetroitSection() {
  return (
    <section id="detroit" data-system-section="detroit" className="relative z-20 w-full overflow-hidden border-t border-amber-400/20 bg-gradient-to-b from-[#100B0E] via-[#140E14] to-[#120E0A]">
      {/* Ambient background glow — Detroit Analog Hardware & Sonic Energy */}
      <div className="pointer-events-none absolute left-[-6rem] top-1/2 h-[600px] w-[600px] -translate-y-1/2 rounded-full bg-[#E91E63]/[0.15] blur-[150px]" />
      <div className="pointer-events-none absolute right-[-6rem] top-1/3 h-[600px] w-[600px] rounded-full bg-[#2196F3]/[0.15] blur-[150px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[800px] rounded-full bg-[#FFB800]/[0.10] blur-[140px]" />

      <div className="mx-auto grid max-w-[1500px] gap-16 px-5 py-28 md:px-10 md:py-40 lg:grid-cols-[0.55fr_1.45fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="flex flex-col justify-between"
        >
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-amber-400/15 px-3.5 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#FFB800] shadow-[0_0_20px_rgba(255,184,0,0.3)]">
              <MapPin size={12} className="text-[#FFB800]" />
              Detroit / 42.3314° N
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/60">
              Built locally around the reality of independent work: too much administration, too many disconnected systems, and not enough time left for the music.
            </p>
          </div>
          <div className="mt-14 hidden font-mono text-[9px] uppercase tracking-[0.22em] text-white/40 lg:block">
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
            <span className="block text-[#FFB800] [text-shadow:0_0_35px_rgba(255,184,0,0.65)]">behind the music scene.</span>
          </h2>
          <div className="mt-12 grid gap-8 border-t border-amber-400/20 pt-8 md:grid-cols-2">
            <p className="text-lg leading-relaxed text-white/70">
              indii started with a practical question: what would independent artists need if the departments and gatekeepers around them were tools for their career instead?
            </p>
            <div className="card-shade-magenta relative overflow-hidden rounded-2xl p-7 shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
              <div className="absolute inset-x-0 top-0 h-[1px] specular-line-magenta" />
              <p className="text-lg leading-relaxed text-white/90">
                The answer is not another dashboard full of promises. It is a working place for the files, decisions, business records, creative work, and approvals already surrounding the artist.
              </p>
              <p className="mt-9 flex items-center gap-3 text-sm font-semibold text-white">
                <span className="h-px w-9 bg-gradient-to-r from-[#FF4081] to-[#E91E63] shadow-[0_0_8px_#FF4081]" />
                <span className="wiil-name text-[#FF80AB] font-bold">wiil</span>, Founder
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
