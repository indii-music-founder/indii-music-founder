'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ScreenshotSlide {
  id: string;
  title: string;
  department: string;
  badge: string;
  caption: string;
  src: string;
  tagColor: string;
}

const HERO_SCREENSHOTS: ScreenshotSlide[] = [
  {
    id: 'dashboard',
    title: 'Command Center',
    department: 'Home & Conductor',
    badge: 'Master Overview',
    caption: 'Catalog velocity, audio master stems, streaming signals, and real-time pending tasks awaiting artist review.',
    src: '/screenshots/dashboard.png',
    tagColor: '#FFB800',
  },
  {
    id: 'creative',
    title: 'Creative Director',
    department: 'Visual Studio',
    badge: 'Video & Canvas',
    caption: 'Timeline video generator, multi-format canvas editor, and unified brand aesthetic enforcement across every asset.',
    src: '/screenshots/creative.png',
    tagColor: '#00FF66',
  },
  {
    id: 'workflow',
    title: 'Workflow Lab',
    department: 'Automation Engine',
    badge: 'Node Automation',
    caption: 'Visual node-based automation canvas linking release milestones, asset generation, and DSP triggers without writing code.',
    src: '/screenshots/workflow.png',
    tagColor: '#A855F7',
  },
  {
    id: 'canvas',
    title: 'Project Canvas',
    department: 'Creative Brainstorming',
    badge: 'Infinite Whiteboard',
    caption: 'Infinite visual moodboarding, release planning, lyric notes, and asset staging for your entire campaign.',
    src: '/screenshots/canvas.png',
    tagColor: '#EC4899',
  },
  {
    id: 'distribution',
    title: 'Distribution Engine',
    department: 'Delivery Preparation',
    badge: 'DDEX ERN 4.3',
    caption: 'Direct delivery preparation console with strict DDEX ERN 4.3 XML validator, audio QC, and global DSP store targeting.',
    src: '/screenshots/distribution.png',
    tagColor: '#2196F3',
  },
  {
    id: 'analytics',
    title: 'Analytics Command',
    department: 'Audio Intelligence',
    badge: 'Sonic DNA©',
    caption: 'Cross-platform streaming analytics, geographic listener clusters, and predictive audience growth modeling.',
    src: '/screenshots/analytics.png',
    tagColor: '#00BCD4',
  },
  {
    id: 'finance',
    title: 'Financial Command',
    department: 'Project Accounting',
    badge: '0% Royalty Cut',
    caption: 'Automated split sheets, smart contract disbursements, and transparent ledger accounting with zero platform fee cuts.',
    src: '/screenshots/finance.png',
    tagColor: '#FFC107',
  },
  {
    id: 'legal',
    title: 'Legal Department',
    department: 'Rights & Agreements',
    badge: 'Plain English',
    caption: 'Lawyer-grade producer agreements, work-for-hire contracts, and cryptographic split sheet signatures built for creators.',
    src: '/screenshots/legal.png',
    tagColor: '#F97316',
  },
  {
    id: 'marketing',
    title: 'Marketing & Rollout',
    department: 'Campaign Strategy',
    badge: 'Waterfall Release',
    caption: '14-day waterfall rollout calendars, DSP editorial pitch generation, and targeted fan acquisition pathways.',
    src: '/screenshots/marketing.png',
    tagColor: '#10B981',
  },
  {
    id: 'screenwriter',
    title: 'Cinematic Screenwriter',
    department: 'Video Production',
    badge: 'Visual Storyboard',
    caption: 'From song lyric to cinematic scene beats, shot lists, and connected intelligence prompt orchestration for official music videos.',
    src: '/screenshots/screenwriter.png',
    tagColor: '#6366F1',
  },
];

export default function HeroScreenshotCarousel() {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [lightboxSlide, setLightboxSlide] = useState<ScreenshotSlide | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll loop when not paused by hover
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % HERO_SCREENSHOTS.length);
    }, 4200);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Handle escape key for lightbox
  useEffect(() => {
    if (!lightboxSlide) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxSlide(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxSlide]);

  const activeSlide = HERO_SCREENSHOTS[activeSlideIndex];

  const handlePrev = () => {
    setActiveSlideIndex((prev) => (prev - 1 + HERO_SCREENSHOTS.length) % HERO_SCREENSHOTS.length);
  };

  const handleNext = () => {
    setActiveSlideIndex((prev) => (prev + 1) % HERO_SCREENSHOTS.length);
  };

  return (
    <div
      className="relative mt-10 w-full overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="indii.music studio screenshots carousel"
    >
      {/* Ambient header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 font-mono text-[10px] text-white/50">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00C853] shadow-[0_0_8px_#00C853]" />
          <span className="font-bold uppercase tracking-[0.2em] text-[#FFB800]">
            Live Studio Surface
          </span>
          <span className="text-white/30 hidden sm:inline">•</span>
          <span className="text-white/60 hidden sm:inline">2560×1440 Retina Captures</span>
        </div>

        {/* Carousel controls */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-white/40">
            {activeSlideIndex + 1} / {HERO_SCREENSHOTS.length}
          </span>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous screenshot"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 hover:border-[#FFB800]/50 hover:bg-white/[0.08] hover:text-white transition-all"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next screenshot"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 hover:border-[#FFB800]/50 hover:bg-white/[0.08] hover:text-white transition-all"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Main Feature Display Card */}
      <div className="lacquer-card relative mt-4 overflow-hidden rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.95)]">
        <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold z-10" />

        <div className="grid gap-0 lg:grid-cols-[1.55fr_1fr]">
          {/* Screenshot Display */}
          <div
            className="group relative aspect-[16/10] w-full cursor-pointer overflow-hidden bg-black/80 lg:aspect-auto lg:min-h-[380px]"
            onClick={() => setLightboxSlide(activeSlide)}
          >
            <img
              src={activeSlide.src}
              alt={`${activeSlide.department} — ${activeSlide.title}`}
              className="h-full w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
              loading="eager"
            />
            {/* Gloss vignette overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity" />

            {/* Click to inspect badge */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-lg bg-black/75 px-3 py-2 font-mono text-[10px] text-white/80 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="flex items-center gap-1.5 text-[#FFB800]">
                <Maximize2 size={12} /> Click to expand full resolution
              </span>
              <span className="text-white/40">Retina 2560×1440</span>
            </div>
          </div>

          {/* Slide Description & Quick Switcher */}
          <div className="flex flex-col justify-between border-t border-white/10 bg-[#0a0a0a]/90 p-5 md:p-6 lg:border-l lg:border-t-0">
            <div>
              <div className="flex items-center justify-between">
                <span
                  className="rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${activeSlide.tagColor}15`,
                    color: activeSlide.tagColor,
                    border: `1px solid ${activeSlide.tagColor}35`,
                  }}
                >
                  {activeSlide.badge}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">
                  {activeSlide.department}
                </span>
              </div>

              <h3 className="mt-3 text-xl font-black tracking-tight text-white md:text-2xl">
                {activeSlide.title}
              </h3>

              <p className="mt-2 text-xs leading-relaxed text-white/70 md:text-sm">
                {activeSlide.caption}
              </p>
            </div>

            {/* Horizontal thumbnail selector ribbon */}
            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="mb-2 font-mono text-[9px] uppercase tracking-widest text-white/40">
                Explore Departments
              </div>
              <div
                ref={scrollRef}
                className="flex gap-2 overflow-x-auto pb-1 no-scrollbar"
              >
                {HERO_SCREENSHOTS.map((slide, index) => {
                  const isCurrent = index === activeSlideIndex;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setActiveSlideIndex(index)}
                      className={`relative flex-shrink-0 overflow-hidden rounded-lg border transition-all duration-300 ${
                        isCurrent
                          ? 'border-[#FFB800] ring-1 ring-[#FFB800]/50 scale-[1.04]'
                          : 'border-white/15 opacity-60 hover:opacity-100 hover:border-white/30'
                      }`}
                      style={{ width: '64px', height: '40px' }}
                      aria-label={`Switch to ${slide.title}`}
                    >
                      <img
                        src={slide.src}
                        alt={slide.title}
                        className="h-full w-full object-cover object-top"
                        loading="lazy"
                      />
                      {isCurrent && (
                        <div className="absolute inset-0 bg-[#FFB800]/20 pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      <AnimatePresence>
        {lightboxSlide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={`${lightboxSlide.title} Full Resolution Capture`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-3 md:p-6 backdrop-blur-2xl"
            onClick={() => setLightboxSlide(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lacquer-card-gold relative max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/20 bg-black shadow-[0_30px_100px_rgba(0,0,0,0.98)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Lightbox Header */}
              <div className="flex items-center justify-between border-b border-white/10 bg-[#0d0d0d] px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: lightboxSlide.tagColor }}
                  />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                    {lightboxSlide.title}
                  </span>
                  <span className="font-mono text-[10px] text-white/40">
                    / {lightboxSlide.department}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxSlide(null)}
                  aria-label="Close preview"
                  className="rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Full Resolution Image Container */}
              <div className="relative max-h-[76vh] overflow-auto bg-black p-2 flex items-center justify-center">
                <img
                  src={lightboxSlide.src}
                  alt={lightboxSlide.title}
                  className="max-h-[74vh] w-auto rounded-lg object-contain shadow-2xl"
                />
              </div>

              {/* Lightbox Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0a0a0a] px-5 py-3 text-xs text-white/70">
                <p className="max-w-3xl text-xs text-white/80">
                  {lightboxSlide.caption}
                </p>
                <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
                  2560×1440 Unwatermarked Retina
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
