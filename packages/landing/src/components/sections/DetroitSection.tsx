'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';

export default function DetroitSection() {
  return (
    <section id="detroit" data-system-section="detroit" className="relative z-20 w-full overflow-hidden border-t border-white/10 bg-[#050505]">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute left-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-[#E91E63]/[0.035] blur-[150px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-[#2196F3]/[0.035] blur-[150px]" />
      <div className="mx-auto grid max-w-[1500px] gap-16 px-5 py-28 md:px-10 md:py-40 lg:grid-cols-[0.55fr_1.45fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="flex flex-col justify-between"
        >
          <div>
            <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
              <MapPin size={12} />
              Detroit / 42.3314° N
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/40">
              Built locally around the reality of independent work: too much administration, too many disconnected systems, and not enough time left for the music.
            </p>
          </div>
          <div className="mt-14 hidden font-mono text-[9px] uppercase tracking-[0.22em] text-white/20 lg:block">
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
          <div className="mt-12 grid gap-8 border-t border-white/10 pt-8 md:grid-cols-2">
            <p className="text-lg leading-relaxed text-white/55">
              indii started with a practical question: what would independent artists need if the departments and gatekeepers around them were tools for their career instead?
            </p>
            <div>
              <p className="text-lg leading-relaxed text-white/55">
                The answer is not another dashboard full of promises. It is a working place for the files, decisions, business records, creative work, and approvals already surrounding the artist.
              </p>
              <p className="mt-9 flex items-center gap-3 text-sm font-semibold text-white">
                <span className="h-px w-9 bg-amber-400" />
                <span className="wiil-name">wiil</span>, Founder
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
