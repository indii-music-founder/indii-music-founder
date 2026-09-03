'use client';

import React from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight, Play } from 'lucide-react';
import { emitSystemPulse } from '../../three/signals';
import { getStudioUrl } from '../../lib/auth';
import { INDII_BRAND } from '@shared/brand';

const heroWords = ['Run', 'your', 'music', 'career', 'without', 'giving', 'it', 'away.'];

interface HeroProps {
  founder: boolean;
  previewEnabled: boolean;
  previewHref: string;
  trackPreview: (location: string) => void;
}

export default function Hero({ founder, previewEnabled, previewHref, trackPreview }: HeroProps) {
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
      {/* Warm Studio Atmospheric Halo — Champagne Gold & Smoked Petroleum Teal */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[1100px] blur-[150px] opacity-80"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,184,0,0.12) 0%, rgba(0,184,212,0.06) 45%, transparent 70%)',
        }}
      />

      <div className="flex items-center justify-between border-t border-white/15 pt-4 font-mono text-[9px] uppercase tracking-[0.23em] text-white/60">
        <span>Independent music / business operating system</span>
        <span className="hidden sm:inline">Detroit, Michigan / Founding Artist Beta</span>
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

        {/* Headline first, then the category explanation and canonical tagline. */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-9 flex flex-col gap-3 md:mt-11"
        >
          <p className="text-xl font-black tracking-[-0.025em] text-white md:text-3xl">
            The operating system for your music independence.
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.22em] text-white/55">
            <span className="font-bold text-white">{INDII_BRAND.name}</span>
            <span aria-hidden="true" className="h-px w-7 bg-white/25" />
            <span className="normal-case tracking-[0.16em]">{INDII_BRAND.tagline}</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.72, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-12 grid gap-9 border-t border-white/15 pt-8 lg:grid-cols-[1.1fr_0.9fr]"
        >
          {/* Left Column: Hero Manifesto & Gatekeeper Card */}
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
              Run the business behind your music
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl lg:text-4xl">
              One connected workspace. <span className="text-[#FFB800] [text-shadow:0_0_25px_rgba(255,184,0,0.6)]">Your direction.</span>
            </h2>

            <p className="mt-4 text-lg font-medium leading-relaxed text-white/80 md:text-xl">
              indii.music brings the business behind your music together—from planning and rights to distribution preparation, campaigns, and money.
            </p>

            {/* No More Gatekeepers / Handlers Card */}
            <div className="mt-6 lacquer-card-gold relative overflow-hidden rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
              <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold" />
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#FFB800] [text-shadow:0_0_12px_rgba(255,184,0,0.4)]">
                  The Freedom Principle
                </span>
                <span className="rounded-full bg-white/[0.04] px-3 py-1 font-mono text-[9px] font-bold text-amber-300/90 border border-amber-400/30">
                  Artist-controlled workspace
                </span>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/60 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-white/20">
                  <div className="text-xs font-black uppercase tracking-wider text-white/90 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2196F3] shadow-[0_0_8px_#2196F3]" />
                    The release stays connected
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/70">
                    Keep assets, rights, plans, campaigns, and financial records attached to the same project.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/60 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-white/20">
                  <div className="text-xs font-black uppercase tracking-wider text-white/90 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00C853] shadow-[0_0_8px_#00C853]" />
                    The right help, in context
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/70">
                    Connected specialists help prepare the work while you remain the artist and decision-maker.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Primary CTAs & Product Status */}
          <div className="lacquer-card relative flex flex-col justify-between overflow-hidden rounded-2xl p-7 shadow-[0_25px_70px_rgba(0,0,0,0.95)]">
            <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold" />
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#FFB800]">
                <span className="h-2 w-2 rounded-full bg-[#00C853] shadow-[0_0_10px_#00C853]" />
                Working software / Founding Artist Beta
              </div>
              <p className="mt-3 text-base text-white/90">
                Join the waitlist for working software that is still being refined with independent artists.
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
                  className="group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] px-7 py-4 text-sm font-black text-black shadow-[0_0_35px_rgba(255,184,0,0.5)] transition-all hover:scale-[1.03] hover:shadow-[0_0_50px_rgba(255,184,0,0.75)]"
                >
                  {previewEnabled
                    ? founder
                      ? 'Enter Founder Preview'
                      : 'Enter indii.music'
                    : 'Get Founding Artist access'}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </a>
                <a
                  href={getStudioUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackPreview('hero_login')}
                  className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.04] px-7 py-4 text-sm font-bold text-white shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all hover:border-amber-400/50 hover:text-amber-300"
                >
                  Log in
                </a>
                <a
                  href="#studio-preview"
                  className="group inline-flex items-center justify-center gap-3 rounded-full border border-white/15 bg-white/[0.03] px-7 py-4 text-sm font-bold text-white/80 backdrop-blur-md transition-all hover:border-[#FFB800]/50 hover:bg-white/[0.06] hover:text-white"
                >
                  <Play size={14} fill="currentColor" />
                  See how indii.music works
                </a>
              </div>
            </div>

            <div className="mt-8 border-t border-white/10 pt-4">
              <div className="grid grid-cols-3 gap-2 text-center font-mono text-[9px] uppercase tracking-wider">
                <div className="rounded-xl bg-black/70 p-2.5 text-white/80 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <span className="block font-black text-white [text-shadow:0_0_8px_rgba(255,255,255,0.4)]">Keep</span> Your rights
                </div>
                <div className="rounded-xl bg-black/70 p-2.5 text-white/80 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <span className="block font-black text-[#FFB800] [text-shadow:0_0_8px_rgba(255,184,0,0.5)]">0%</span> Royalty Cut
                </div>
                <div className="rounded-xl bg-black/70 p-2.5 text-white/80 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <span className="block font-black text-[#00C853] [text-shadow:0_0_8px_rgba(0,200,83,0.5)]">Live</span> Working beta
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
