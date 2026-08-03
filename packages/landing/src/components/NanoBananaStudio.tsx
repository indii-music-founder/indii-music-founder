'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Wand2,
  Maximize2,
  UserCheck,
  Palette,
  Layers,
  ArrowRight,
  Zap,
  CheckCircle2,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

const studioFeatures = [
  {
    id: 'identity',
    title: 'Identity Retention Engine',
    subtitle: 'Your face & style locked across every asset',
    description:
      'Upload up to 4 artist reference photos. Nano Banana locks your exact facial likeness, aesthetic, and character structure across album art, press photos, and social campaigns with 100% consistency.',
    badge: '14 Reference Assets',
    stat: '100% Face Match',
    color: 'from-amber-400 to-yellow-500',
  },
  {
    id: 'multiturn',
    title: 'Conversational Visual Editing',
    subtitle: 'Iterate images like talking to a Creative Director',
    description:
      'Change lighting, swap backgrounds, adjust clothing, or refine textures using plain English prompts. The model remembers spatial arrangement and lighting across turns via encrypted thought state signatures.',
    badge: 'Stateful Reasoning',
    stat: 'Instant Turnaround',
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'inpaint',
    title: 'Semantic Inpainting & Outpainting',
    subtitle: 'Expand 1:1 Album Art into 16:9 & 9:16 Video Banners',
    description:
      'Turn a square cover into a wide YouTube banner or vertical TikTok visualizer. Seamlessly expand canvas borders or erase/insert elements without re-generating from scratch.',
    badge: '14 Aspect Ratios',
    stat: '4K Native Render',
    color: 'from-yellow-400 to-amber-500',
  },
  {
    id: 'style',
    title: 'Precision Style Transfer',
    subtitle: 'Apply professional aesthetic filters without losing subject structure',
    description:
      'Force specific visual aesthetics—noir photography, analog film grain, cyberpunk neon, or minimalist oil—while strictly preserving subject layout.',
    badge: 'Aesthetic Lock',
    stat: 'Zero Distortion',
    color: 'from-amber-300 to-yellow-400',
  },
];

export default function NanoBananaStudio() {
  const [activeFeature, setActiveFeature] = useState(0);
  const feature = studioFeatures[activeFeature];

  return (
    <section id="nano-banana" className="relative z-20 w-full overflow-hidden border-t border-amber-400/30 bg-[#030303] py-28 md:py-40">
      {/* High-Impact Visual POP Background Glows */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.18),transparent_60%)] blur-[120px]" />
      <div className="pointer-events-none absolute right-10 top-20 h-96 w-96 rounded-full bg-amber-500/10 blur-[140px]" />

      <div className="relative mx-auto max-w-[1500px] px-5 md:px-10">
        {/* Section Header with POP */}
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 px-5 py-2 font-mono text-[11px] uppercase font-bold tracking-[0.25em] text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            <Sparkles size={14} className="animate-pulse text-amber-400" />
            The Creative Powerhouse / Nano Banana Engine
          </div>

          <h2 className="mt-8 text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-7xl md:text-8xl">
            Visual brilliance. <br />
            <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(245,158,11,0.4)]">
              Powered by Nano Banana.
            </span>
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-white/60 md:text-2xl">
            Stop paying thousands for single album artwork or generic stock photos. Nano Banana gives you conversational 4K visual generation with true artist identity preservation.
          </p>
        </div>

        {/* Feature Selector & Showcase Grid */}
        <div className="mt-16 grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          {/* Left Feature Buttons */}
          <div className="space-y-4">
            {studioFeatures.map((item, index) => {
              const isActive = activeFeature === index;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveFeature(index)}
                  className={`group relative flex w-full flex-col rounded-2xl border p-6 text-left transition-all duration-300 ${
                    isActive
                      ? 'border-amber-400/80 bg-gradient-to-r from-amber-950/40 via-black to-black shadow-[0_0_40px_rgba(245,158,11,0.25)] scale-[1.02]'
                      : 'border-white/10 bg-black/60 text-white/60 hover:border-white/25 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${
                        isActive ? 'text-amber-400' : 'text-white/30'
                      }`}
                    >
                      0{index + 1} / {item.badge}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase ${
                        isActive ? 'bg-amber-400 text-black' : 'bg-white/5 text-white/40'
                      }`}
                    >
                      {item.stat}
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-bold tracking-tight text-white md:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs text-white/50">{item.subtitle}</p>
                </button>
              );
            })}
          </div>

          {/* Right Display Stage (Glassmorphic Showcase) */}
          <div className="relative min-h-[540px] overflow-hidden rounded-3xl border border-amber-400/40 bg-gradient-to-b from-[#0e0c08] to-[#040404] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.9)] backdrop-blur-2xl md:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(245,158,11,0.15),transparent_40%)]" />

            <AnimatePresence mode="wait">
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35 }}
                className="relative flex h-full flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                        <Wand2 size={20} />
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          Nano Banana Studio v3
                        </div>
                        <div className="text-sm font-semibold text-white">{feature.title}</div>
                      </div>
                    </div>
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-[10px] text-amber-300">
                      4K Output Active
                    </span>
                  </div>

                  <p className="mt-8 text-lg leading-relaxed text-white/80 md:text-xl">
                    {feature.description}
                  </p>
                </div>

                {/* Mock Studio Controls & Visual Proof */}
                <div className="mt-10 rounded-2xl border border-white/15 bg-black/80 p-6 backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 font-mono text-[10px] uppercase text-white/50">
                    <span>Reference Image Tray (14 Max)</span>
                    <span className="text-emerald-400 font-bold">Identity Locked</span>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {[
                      'Artist Face Ref 01',
                      'Artist Face Ref 02',
                      'Color Palette Ref',
                      'Style Texture Ref',
                    ].map((refName, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/[0.05] p-3 text-center transition-transform hover:scale-105"
                      >
                        <UserCheck size={18} className="text-amber-400" />
                        <span className="mt-2 font-mono text-[9px] text-white/70">{refName}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 font-mono text-xs text-white/60">
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal size={14} className="text-amber-400" />
                      Aspect Ratios: 1:1 / 16:9 / 9:16 / 5:1
                    </span>
                    <span className="text-amber-400 font-bold">Thought Signature: Active</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
