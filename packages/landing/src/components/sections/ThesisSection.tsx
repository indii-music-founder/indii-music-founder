'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Film, Play } from 'lucide-react';

const ambientStars = Array.from({ length: 50 }, (_, index) => ({
  left: `${(index * 37.31) % 100}%`,
  top: `${(index * 61.73) % 100}%`,
  size: `${index % 9 === 0 ? 2 : index % 4 === 0 ? 1.5 : 1}px`,
  opacity: 0.12 + ((index * 17) % 48) / 100,
}));

interface ThesisSectionProps {
  setIsThesisOpen: (open: boolean) => void;
}

export default function ThesisSection({ setIsThesisOpen }: ThesisSectionProps) {
  return (
    <section data-system-section="thesis" className="relative z-20 min-h-[92vh] w-full overflow-hidden border-t border-white/10 bg-black">
      <div className="absolute inset-0">
        {ambientStars.map((star, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-white"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
            }}
          />
        ))}
        <div className="absolute inset-x-[-15%] bottom-[-45%] h-[85%] rounded-[50%] border-t border-amber-400/50 bg-gradient-to-t from-amber-500/[0.18] via-amber-400/[0.06] to-transparent shadow-[0_-40px_140px_rgba(255,184,0,0.25)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(255,184,0,0.18),transparent_65%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[92vh] max-w-[1500px] flex-col justify-between px-5 py-12 md:px-10 md:py-16">
        <div className="flex justify-between border-t border-amber-400/20 pt-4 font-mono text-[9px] uppercase tracking-[0.23em] text-white/50">
          <span>The <span className="indii-name text-white">indii</span> thesis</span>
          <span>Episode I / Everything to Everybody</span>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-6xl py-20 text-center"
        >
          <Film size={28} className="mx-auto mb-8 text-[#FFB800] drop-shadow-[0_0_25px_rgba(255,184,0,0.9)]" />
          <h2 className="text-6xl font-black uppercase leading-[0.82] tracking-[-0.065em] text-white sm:text-7xl md:text-9xl lg:text-[10.5rem]">
            Read the
            <span className="block text-[#FFB800] [text-shadow:0_0_55px_rgba(255,184,0,0.7)]">argument.</span>
          </h2>
          <p className="mx-auto mt-9 max-w-2xl text-lg leading-relaxed text-white/75 md:text-xl">
            Why an independent artist does not need one more isolated tool. They need the work around the music to understand the work beside it.
          </p>
          <button
            type="button"
            onClick={() => setIsThesisOpen(true)}
            className="group mt-10 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] px-9 py-4 text-sm font-black text-black shadow-[0_0_45px_rgba(255,184,0,0.6)] transition-all hover:scale-[1.04] hover:shadow-[0_0_65px_rgba(255,184,0,0.85)]"
          >
            Launch cinematic thesis
            <Play size={14} fill="currentColor" />
          </button>
        </motion.div>

        <div className="grid gap-2 border-y border-white/10 py-5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/30 sm:grid-cols-3">
          <span>Six chapters</span>
          <span className="sm:text-center">Artist ownership at the center</span>
          <span className="sm:text-right">Soundtrack optional</span>
        </div>
      </div>
    </section>
  );
}
