'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowRight, Play, X } from 'lucide-react';
import { emitSystemPulse } from '../../three/signals';
import { getStudioUrl } from '../../lib/auth';
import { INDII_BRAND } from '@shared/brand';
import HeroScreenshotCarousel from '../HeroScreenshotCarousel';

const heroWords = ['Run', 'your', 'music', 'career', 'without', 'giving', 'it', 'away.'];

interface HeroProps {
  founder: boolean;
  previewEnabled: boolean;
  previewHref: string;
  trackPreview: (location: string) => void;
}

export default function Hero({ founder, previewEnabled, previewHref, trackPreview }: HeroProps) {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const heroScale = useTransform(scrollYProgress, [0, 0.16], [1, reducedMotion ? 1 : 0.96]);
  const heroY = useTransform(scrollYProgress, [0, 0.16], [0, reducedMotion ? 0 : 40]);

  useEffect(() => {
    if (!isVideoModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsVideoModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isVideoModalOpen]);

  const pulseHero = (strength: number) => {
    emitSystemPulse('cta', 0, strength);
  };

  return (
    <motion.section
      id="home"
      data-system-section="hero"
      style={{ scale: heroScale, y: heroY }}
      className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col justify-between px-5 pb-6 pt-24 md:px-10 md:pb-8 md:pt-28"
      aria-label="indii.music founder introduction"
    >
      {/* Warm Studio Atmospheric Halo — Champagne Gold & Molten Ruby Embers on Gloss Piano Black */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[1100px] blur-[150px] opacity-85"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,184,0,0.12) 0%, rgba(0,184,212,0.04) 60%, transparent 75%)',
        }}
      />

      <div className="flex items-center justify-between border-t border-white/15 pt-4 font-mono text-[9px] uppercase tracking-[0.23em] text-white/60">
        <span>indii.music / independent music business platform</span>
        <span className="hidden sm:inline">Detroit, Michigan / Founding Artist Beta</span>
      </div>

      <div className="relative my-auto py-6 md:py-8">
        <h1
          className="relative max-w-[1450px] text-[12vw] font-black leading-[0.94] tracking-[-0.06em] text-white sm:text-[9.5vw] md:text-[7.5vw] lg:text-[5.5rem] xl:text-[6.8rem]"
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
                  ? 'text-[#FFB800] [text-shadow:0_0_40px_rgba(255,184,0,0.35)] font-black'
                  : ''
              }`}
            >
              {word === 'it' ? (
                <span className="relative inline-flex items-baseline" aria-hidden="true">
                  <span className="relative inline-block">
                    <motion.span
                      className="absolute -top-[0.16em] left-[50%] -translate-x-1/2 text-[0.30em] font-black text-[#FFB800]"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.85, 1, 0.85] }}
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

        {/* One promise, one explanation, one action. */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-6 max-w-3xl md:mt-8"
        >
          <p className="text-xl font-black tracking-[-0.025em] text-white md:text-2xl lg:text-3xl">
            The operating system for your music independence.
          </p>
          <p className="mt-3 text-base font-medium leading-relaxed text-white/75 md:text-lg">
            indii.music brings the business behind your music together—from planning and rights to distribution preparation, campaigns, and money.
          </p>
          <p className="mt-2 font-mono text-[11px] normal-case tracking-[0.16em] text-white/50">{INDII_BRAND.tagline}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a
              href={previewHref}
              target={previewEnabled ? '_blank' : undefined}
              rel={previewEnabled ? 'noopener noreferrer' : undefined}
              onClick={() => {
                trackPreview('hero');
                pulseHero(1);
              }}
              onMouseEnter={() => pulseHero(0.55)}
              className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#E65100] px-6 py-3.5 text-sm font-black text-black transition-all hover:brightness-110"
            >
              <span>
                {previewEnabled
                  ? founder
                    ? 'Enter Founder Preview'
                    : 'Enter indii.music'
                  : 'Get Founding Artist access'}
              </span>
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={getStudioUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPreview('hero_login')}
              className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:border-amber-400/50 hover:text-amber-300"
            >
              Log in
            </a>
            <a
              href="#studio-preview"
              onClick={(e) => {
                e.preventDefault();
                trackPreview('hero_watch_video');
                setIsVideoModalOpen(true);
              }}
              className="inline-flex cursor-pointer items-center justify-center gap-2 px-2 py-3.5 text-sm font-bold text-white/75 transition-colors hover:text-white"
            >
              <Play size={13} fill="currentColor" />
              See how indii.music works
            </a>
          </div>

          <p className="mt-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
            <span className="h-2 w-2 rounded-full bg-[#00C853]" aria-hidden="true" />
            <span>Working software / Founding Artist Beta</span>
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
            <span className="font-bold text-[#FFB800]">The Freedom Principle©</span>
            <span aria-hidden="true" className="mx-2 text-white/25">·</span>
            <span>Keep your rights</span>
            <span aria-hidden="true" className="mx-2 text-white/25">·</span>
            <span>0% royalty cut</span>
          </p>
        </motion.div>

        {/* Live Studio Surface / Hero Screenshot Carousel */}
        <HeroScreenshotCarousel />
      </div>

      <a
        href="#detroit"
        className="flex items-center justify-between border-t border-white/12 pt-4 font-mono text-[9px] uppercase tracking-[0.23em] text-white/45 transition-colors hover:text-white"
      >
        <span>Continue</span>
        <ArrowDown size={14} />
      </a>

      {/* Video Walkthrough Modal */}
      <AnimatePresence>
        {isVideoModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="indii.music product walkthrough video"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-2xl md:p-8"
            onClick={() => setIsVideoModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lacquer-card-gold relative w-full max-w-5xl overflow-hidden rounded-2xl border border-white/20 bg-black shadow-[0_30px_100px_rgba(0,0,0,0.95)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/10 bg-[#0d0d0d] px-5 py-3">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#FFB800]">
                  <span className="h-2 w-2 rounded-full bg-[#00C853] shadow-[0_0_8px_#00C853]" />
                  Official Product Walkthrough / 1080p
                </div>
                <button
                  type="button"
                  onClick={() => setIsVideoModalOpen(false)}
                  aria-label="Close video"
                  className="rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="relative aspect-video w-full bg-black">
                <video
                  controls
                  autoPlay
                  playsInline
                  src="/videos/indii-overview.mp4"
                  poster="/videos/indii-overview-poster.jpg"
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0a0a0a] px-5 py-3 text-xs text-white/70">
                <span>1:18 Overview of indii.music workspace.</span>
                <a
                  href="#studio-preview"
                  onClick={() => setIsVideoModalOpen(false)}
                  className="font-mono text-[10px] uppercase tracking-wider text-amber-400 hover:underline"
                >
                  Explore Studio Preview ↓
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
