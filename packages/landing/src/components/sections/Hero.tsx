'use client';

import React from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight, Play } from 'lucide-react';
import { emitSystemPulse } from '../../three/signals';

const heroWords = ['Run', 'your', 'music', 'career', 'without', 'giving', 'it', 'away.'];

interface HeroProps {
  founder: boolean;
  previewEnabled: boolean;
  previewHref: string;
  trackPreview: (location: string) => void;
  setIsThesisOpen: (open: boolean) => void;
}

export default function Hero({ founder, previewEnabled, previewHref, trackPreview, setIsThesisOpen }: HeroProps) {
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  // Under prefers-reduced-motion the hero stays put: no scroll-linked
  // translation or scale (opacity fade only, and only if the OS allows it).
  const heroOpacity = useTransform(scrollYProgress, [0, 0.13], [1, reducedMotion ? 1 : 0.14]);
  const heroScale = useTransform(scrollYProgress, [0, 0.16], [1, reducedMotion ? 1 : 0.93]);
  const heroY = useTransform(scrollYProgress, [0, 0.16], [0, reducedMotion ? 0 : 90]);

  const pulseHero = (strength: number) => {
    emitSystemPulse('cta', 0, strength);
  };

  return (
    <motion.section
      id="home"
      data-system-section="hero"
      style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
      className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col justify-between px-5 pb-8 pt-28 md:px-10 md:pb-10 md:pt-32"
      aria-label="indii.music founder introduction"
    >
      <div className="flex items-center justify-between border-t border-white/12 pt-4 font-mono text-[9px] uppercase tracking-[0.23em] text-white/45">
        <span>Independent music / operating workspace</span>
        <span className="hidden sm:inline">Detroit, Michigan / Private founder preview</span>
      </div>

      <div className="relative my-auto py-16 md:py-12">
        <h1
          className="relative max-w-[1450px] text-[15.4vw] font-black leading-[0.73] tracking-[-0.075em] text-white sm:text-[12.3vw] lg:text-[10.6rem]"
          aria-label="Run your music career without giving it away."
        >
          {heroWords.map((word, index) => (
            <motion.span
              key={`${word}-${index}`}
              initial={{ opacity: 0, y: 50, filter: 'blur(12px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                duration: 0.95,
                delay: index * 0.055,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`mr-[0.18em] inline-block last:mr-0 ${
                word === 'music' || word === 'away.'
                  ? 'text-[#FFB800] [text-shadow:0_0_45px_rgba(255,184,0,0.75)] font-black'
                  : ''
              }`}
            >
              {word === 'it' ? (
                <span className="relative inline-flex items-baseline" aria-hidden="true">
                  <span className="relative inline-block">
                    <motion.span
                      className="absolute -top-[0.26em] left-[50%] -translate-x-1/2 text-[0.34em] font-black text-[#FFB800] [text-shadow:0_0_20px_rgba(255,184,0,0.95)]"
                      animate={{ scale: [1, 1.25, 1], opacity: [0.85, 1, 0.85] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      $
                    </motion.span>
                    <span className="inline-block text-white" style={{ fontFamily: 'inherit' }}>
                      ı
                    </span>
                  </span>
                  <span aria-hidden="true">t</span>
                </span>
              ) : (
                word
              )}
            </motion.span>
          ))}
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-12 grid gap-9 border-t border-white/12 pt-8 lg:grid-cols-[1.1fr_0.9fr]"
        >
          {/* Left Column: Hero Manifesto & Gatekeeper Card */}
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
              The Artist Operating System
            </div>

            {/* New Catchphrase */}
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl lg:text-4xl">
              Tools for your music career <span className="text-[#FFB800] [text-shadow:0_0_25px_rgba(255,184,0,0.6)]">without sacrifice</span>.
            </h2>

            <p className="mt-4 text-lg font-medium leading-relaxed text-white/80 md:text-xl">
              Artists already bypassed labels and recording studios. <span className="text-amber-400 font-bold">Distribution is the last gatekeeper standing.</span> Everything you create sits right in front of the pipeline.
            </p>

            {/* No More Gatekeepers / Handlers Card */}
            <div className="mt-6 specular-card rounded-2xl p-6 shadow-[0_10px_50px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">
                  The Freedom Principle
                </span>
                <span className="rounded bg-amber-400/20 px-2.5 py-0.5 font-mono text-[9px] font-bold text-amber-300 border border-amber-400/40">
                  Direct Distribution Pipeline
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="border-l-2 border-amber-400 pl-3">
                  <div className="text-xs font-black uppercase tracking-wider text-white">Distribution IS The Workspace</div>
                  <p className="mt-1 text-xs leading-relaxed text-white/70">
                    Instead of 20 fragmented tools scattered everywhere, all assets, rights, and rollouts sit directly connected in front of your distribution pipeline.
                  </p>
                </div>
                <div className="border-l-2 border-amber-400 pl-3">
                  <div className="text-xs font-black uppercase tracking-wider text-white">No Handlers. 24 Specialists.</div>
                  <p className="mt-1 text-xs leading-relaxed text-white/70">
                    No middleman making decisions for you. You call the shots—our 24 agent specialists coordinate the work and guide the pipeline.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Primary CTAs & Guarantee Badges */}
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-7 backdrop-blur-md">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">
                Immediate Access / Founder Edition
              </div>
              <p className="mt-3 text-base text-white/70">
                Join independent artists taking control of their releases, catalog, and finances.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href={previewHref}
                  target={previewEnabled ? '_blank' : undefined}
                  rel={previewEnabled ? 'noopener noreferrer' : undefined}
                  onClick={() => {
                    trackPreview('hero');
                    pulseHero(1);
                  }}
                  onMouseEnter={() => pulseHero(0.55)}
                  className="group inline-flex items-center justify-center gap-3 rounded-full bg-amber-400 px-7 py-4 text-sm font-black text-black shadow-[0_0_34px_rgba(245,158,11,0.35)] transition-all hover:scale-[1.03]"
                >
                  {previewEnabled
                    ? founder
                      ? 'Enter Founder Preview'
                      : 'Enter indii.music'
                    : 'Join Waitlist'}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </a>
                {founder && (
                  <button
                    type="button"
                    onClick={() => setIsThesisOpen(true)}
                    className="group inline-flex items-center justify-center gap-3 rounded-full border border-white/20 px-7 py-4 text-sm font-bold text-white transition-colors hover:border-amber-400/50 hover:text-amber-300"
                  >
                    <Play size={14} fill="currentColor" />
                    Watch the Thesis
                  </button>
                )}
              </div>
            </div>

            <div className="mt-8 border-t border-white/10 pt-4">
              <div className="grid grid-cols-3 gap-2 text-center font-mono text-[9px] uppercase tracking-wider">
                <div className="rounded bg-black/60 p-2 text-white/80 border border-white/5">
                  <span className="block font-bold text-amber-400">100%</span> Rights
                </div>
                <div className="rounded bg-black/60 p-2 text-white/80 border border-white/5">
                  <span className="block font-bold text-amber-400">0%</span> Royalty Cut
                </div>
                <div className="rounded bg-black/60 p-2 text-white/80 border border-white/5">
                  <span className="block font-bold text-amber-400">24</span> Departments
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <a
        href="#detroit"
        className="flex items-center justify-between border-t border-white/12 pt-4 font-mono text-[9px] uppercase tracking-[0.23em] text-white/45 transition-colors hover:text-white"
      >
        <span>Continue</span>
        <ArrowDown size={14} />
      </a>
    </motion.section>
  );
}
