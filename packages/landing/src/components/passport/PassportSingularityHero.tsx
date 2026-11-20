import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Pause, Play, Sparkles } from 'lucide-react';
import { NOW_WHAT_CAMPAIGNS } from '../../lib/nowWhatCampaign';

export type NowWhatCampaign = (typeof NOW_WHAT_CAMPAIGNS)[number];

export interface PassportSingularityHeroProps {
  entry?: NowWhatCampaign;
  referralQuery: string;
  motionPaused: boolean;
  onToggleMotion: () => void;
  onPullChange: (active: boolean) => void;
  onStart: () => void;
  onExploreGuide: () => void;
  onAnchorElement: (el: HTMLDivElement | null) => void;
}

const ORBITAL_SIGNALS = [
  { label: 'MLC · Mechanicals', angleClass: '-left-4 top-6 lg:-left-20 lg:top-8', dot: 'bg-[#FFB800]' },
  { label: 'PRO · Splits & Cues', angleClass: '-right-4 top-8 lg:-right-20 lg:top-10', dot: 'bg-[#00F0FF]' },
  { label: 'ISRC · Master Rights', angleClass: '-left-6 top-[44%] lg:-left-24 lg:top-[42%]', dot: 'bg-[#FE2E9A]' },
  { label: 'Sync · Release Prep', angleClass: '-right-6 top-[44%] lg:-right-24 lg:top-[42%]', dot: 'bg-[#FFB800]' },
] as const;

export default function PassportSingularityHero({
  entry,
  referralQuery,
  motionPaused,
  onToggleMotion,
  onPullChange,
  onStart,
  onExploreGuide,
  onAnchorElement,
}: PassportSingularityHeroProps) {
  const [pullActive, setPullActive] = useState(false);
  const [magneticOffset, setMagneticOffset] = useState({ x: 0, y: 0 });
  const buttonBoxRef = useRef<HTMLDivElement | null>(null);

  const assignButtonBox = (el: HTMLDivElement | null) => {
    buttonBoxRef.current = el;
    onAnchorElement(el);
  };

  const setPull = (active: boolean) => {
    setPullActive(active);
    onPullChange(active);
    if (!active) setMagneticOffset({ x: 0, y: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (motionPaused || !buttonBoxRef.current) return;
    const rect = buttonBoxRef.current.getBoundingClientRect();
    const dx = ((e.clientX - (rect.left + rect.width / 2)) / Math.max(rect.width, 1)) * 12;
    const dy = ((e.clientY - (rect.top + rect.height / 2)) / Math.max(rect.height, 1)) * 8;
    setMagneticOffset({
      x: Math.max(-6, Math.min(6, dx)),
      y: Math.max(-5, Math.min(5, dy)),
    });
  };

  return (
    <motion.div
      key="step-0"
      initial={motionPaused ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionPaused ? 0 : 0.35 }}
      className="relative mx-auto w-full max-w-4xl text-center"
    >
      {/* Decorative Gravitational Orbit Vectors & Domain Telemetry Nodes pointing toward CTA */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 hidden md:block"
      >
        <svg
          viewBox="0 0 900 560"
          className={`h-full w-full transition-transform duration-700 ease-out ${
            pullActive && !motionPaused ? 'scale-[0.94]' : 'scale-100'
          }`}
          fill="none"
        >
          {/* Outer gravitational field lines */}
          <ellipse
            cx="450"
            cy="332"
            rx="380"
            ry="190"
            stroke="url(#horizonGold)"
            strokeOpacity={pullActive ? '0.42' : '0.18'}
            strokeDasharray="3 8"
            strokeWidth="1"
          />
          <ellipse
            cx="450"
            cy="332"
            rx="272"
            ry="128"
            stroke="url(#horizonCyan)"
            strokeOpacity={pullActive ? '0.55' : '0.24'}
            strokeWidth="1"
          />
          <circle
            cx="450"
            cy="332"
            r="156"
            stroke="#FFB800"
            strokeOpacity={pullActive ? '0.62' : '0.28'}
            strokeDasharray="2 6"
            strokeWidth="1.25"
          />
          {/* Converging vectors pulling periphery into centered CTA */}
          <line x1="120" y1="88" x2="450" y2="332" stroke="url(#vectorPull)" strokeWidth="1" />
          <line x1="780" y1="92" x2="450" y2="332" stroke="url(#vectorPull)" strokeWidth="1" />
          <line x1="90" y1="255" x2="450" y2="332" stroke="url(#vectorPull)" strokeWidth="1" />
          <line x1="810" y1="255" x2="450" y2="332" stroke="url(#vectorPull)" strokeWidth="1" />
          <defs>
            <linearGradient id="horizonGold" x1="70" y1="332" x2="830" y2="332" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E65100" stopOpacity="0" />
              <stop offset="50%" stopColor="#FFB800" stopOpacity="1" />
              <stop offset="100%" stopColor="#00F0FF" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="horizonCyan" x1="178" y1="332" x2="722" y2="332" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#FFB800" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#FE2E9A" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="vectorPull" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFB800" stopOpacity="0" />
              <stop offset="70%" stopColor="#FFB800" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#FFD700" stopOpacity="0.7" />
            </linearGradient>
          </defs>
        </svg>

        {ORBITAL_SIGNALS.map((sig) => (
          <div
            key={sig.label}
            className={`absolute ${sig.angleClass} flex items-center gap-2 rounded-full border bg-black/75 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] backdrop-blur-md transition-all duration-500 ${
              pullActive
                ? 'scale-95 border-[#FFB800]/55 text-[#FFD700] shadow-[0_0_20px_rgba(255,184,0,0.22)]'
                : 'border-white/15 text-[#9AA1B2]'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${sig.dot}`} />
            <span>{sig.label}</span>
          </div>
        ))}
      </div>

      {/* Top Eyebrow + WCAG 2.2.2 Motion Control */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#FFB800]/35 bg-black/70 px-3.5 py-1.5 text-[11px] font-mono tracking-wide text-[#FFD56B] shadow-[0_0_24px_rgba(255,184,0,0.14)] backdrop-blur-md sm:text-xs">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#FFB800]" aria-hidden="true" />
          <span>People make the music, indii makes the business.</span>
        </div>

        <button
          type="button"
          onClick={onToggleMotion}
          className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-white/20 bg-black/75 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-[#B4B9C7] backdrop-blur-md transition-colors hover:border-[#FFB800]/50 hover:text-white focus-visible:outline-[3px] focus-visible:outline-[#FFB800] focus-visible:outline-offset-[3px]"
        >
          {motionPaused ? (
            <>
              <Play className="h-3 w-3 text-[#FFB800]" aria-hidden="true" />
              <span>Play horizon</span>
            </>
          ) : (
            <>
              <Pause className="h-3 w-3 text-[#FFB800]" aria-hidden="true" />
              <span>Pause horizon</span>
            </>
          )}
        </button>
      </div>

      {/* Headline & Lead anchored cleanly above the accretion horizon (no hard box edges) */}
      <div className="relative mx-auto mt-5 max-w-4xl px-6 py-4 bg-[radial-gradient(ellipse_at_50%_48%,rgba(0,0,0,0.68)_0%,rgba(0,0,0,0.28)_45%,transparent_70%)]">
        <h1 className="text-4xl font-black leading-[1.03] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] sm:text-5xl md:text-6xl">
          {entry?.situation ?? 'How ready is your music'}{' '}
          <span className="inline-block bg-gradient-to-r from-[#FFF6D6] via-[#FFD700] to-[#FFB800] bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(255,184,0,0.35)]">
            {entry ? 'Now what?' : 'for business?'}
          </span>
        </h1>

        <p className="mx-auto mt-3.5 max-w-xl text-base leading-relaxed text-[#E2E6F0] drop-shadow-[0_2px_14px_rgba(0,0,0,0.98)] sm:text-lg">
          {entry?.id === 'first-song'
            ? 'In two minutes, see which credits, ownership details, and release steps to check first.'
            : entry?.answer ?? 'Answer a few questions about your music business to see what to check next. It takes about two minutes.'}
        </p>
      </div>

      {/* Primary Event Horizon CTA Centered Directly at Gravitational Axis (x = 50%) */}
      <div className="relative mt-6 flex flex-col items-center justify-center gap-3.5">
        <div
          ref={assignButtonBox}
          onPointerEnter={() => setPull(true)}
          onPointerLeave={() => setPull(false)}
          onPointerMove={handlePointerMove}
          className="relative flex w-full items-center justify-center sm:w-auto"
        >
          {/* Ambient Singularity Halo framing button */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -inset-4 rounded-2xl bg-[radial-gradient(circle,rgba(255,184,0,0.45)_0%,rgba(230,81,0,0.16)_50%,transparent_72%)] blur-xl transition-all duration-500 ${
              pullActive ? 'scale-125 opacity-100' : 'scale-100 opacity-75'
            }`}
          />
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute -inset-[2px] rounded-[14px] bg-gradient-to-r from-[#FFF4CC] via-[#FFB800] to-[#00F0FF] opacity-75 blur-[1px] transition-opacity duration-300 ${
              pullActive ? 'opacity-100' : 'opacity-65'
            }`}
          />
          <button
            type="button"
            onClick={onStart}
            onFocus={() => setPull(true)}
            onBlur={() => setPull(false)}
            style={
              !motionPaused && (magneticOffset.x !== 0 || magneticOffset.y !== 0)
                ? { transform: `translate3d(${magneticOffset.x}px, ${magneticOffset.y}px, 0)` }
                : undefined
            }
            className="relative z-10 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#FFE07D] via-[#FFB800] to-[#E66800] px-9 font-black text-black shadow-[0_0_40px_rgba(255,184,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.65)] transition-[transform,box-shadow] duration-200 hover:scale-[1.04] hover:shadow-[0_0_58px_rgba(255,184,0,0.78)] active:scale-[0.98] focus-visible:outline-[3px] focus-visible:outline-[#FFB800] focus-visible:outline-offset-[4px] sm:w-auto"
          >
            <span>Find my next steps</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <Link
          to={`/${referralQuery}${referralQuery.includes('?') ? '&' : '?'}from=passport_hero`}
          onClick={onExploreGuide}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-black/80 px-6 text-sm font-semibold text-white/90 backdrop-blur-md transition-all hover:border-[#FFB800]/55 hover:bg-black/95 hover:text-white focus-visible:outline-[3px] focus-visible:outline-[#FFB800] focus-visible:outline-offset-[3px] sm:w-auto"
        >
          <span>Explore Platform Guide & Wiki</span>
          <Compass className="h-4 w-4 text-[#FFB800]" aria-hidden="true" />
        </Link>
      </div>

      {/* Three Precision Obsidian Telemetry Pillars */}
      <div className="mt-8 grid grid-cols-1 gap-3.5 border-t border-white/15 pt-6 text-left sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl border border-white/15 bg-black/75 p-4 backdrop-blur-md">
          <div className="specular-line-gold pointer-events-none absolute inset-x-0 top-0 h-px opacity-75" />
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[#FFB800]">
            <span>Fast & Focused</span>
            <span className="text-white/40">01</span>
          </div>
          <div className="mt-1.5 text-sm font-bold text-white">2-Minute Diagnostic</div>
          <p className="mt-1 text-xs leading-relaxed text-[#9AA1B2]">
            Immediate readiness score and prioritized next steps.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-white/15 bg-black/75 p-4 backdrop-blur-md">
          <div className="specular-line-cyan pointer-events-none absolute inset-x-0 top-0 h-px opacity-75" />
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[#00F0FF]">
            <span>Royalty Radar</span>
            <span className="text-white/40">02</span>
          </div>
          <div className="mt-1.5 text-sm font-bold text-white">Royalty registrations & splits</div>
          <p className="mt-1 text-xs leading-relaxed text-[#9AA1B2]">
            See which royalty registrations and split records to check next.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-white/15 bg-black/75 p-4 backdrop-blur-md">
          <div className="specular-line-gold pointer-events-none absolute inset-x-0 top-0 h-px opacity-75" />
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[#FFB800]">
            <span>Entry Point</span>
            <span className="text-white/40">03</span>
          </div>
          <div className="mt-1.5 text-sm font-bold text-white">100% Human-Made Music</div>
          <p className="mt-1 text-xs leading-relaxed text-[#9AA1B2]">
            No AI-generated tracks get in. Built for artists who own their masters.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
