import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass, Disc3, LogIn } from 'lucide-react';
import { INDII_BRAND } from '@shared/brand';
import { getStudioUrl } from '../lib/auth';
import { SIGNATURE_BUTTON_BASE, SIGNATURE_BUTTON_TONES } from '@shared/share/signatureButton';

const gold = SIGNATURE_BUTTON_TONES.gold;

export default function NotFound() {
  const studioUrl = getStudioUrl();

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-x-hidden bg-[#030303] px-5 py-8 text-white md:px-10 md:py-10">
      {/* Atmospheric run-out groove vinyl photograph */}
      <img
        src="/images/studio-runout-404.jpg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 h-full w-full object-cover object-center opacity-25 mix-blend-screen"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,184,0,0.08)_0%,rgba(3,3,3,0.82)_58%,#030303_100%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-[1400px] items-center justify-between border-b border-white/10 pb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">
        <Link to="/" className="font-sans text-sm font-black tracking-tight text-white hover:text-[#FFB800] transition-colors">
          {INDII_BRAND.name}
        </Link>
        <span>Run-out groove · 404</span>
      </header>

      <main className="relative z-10 mx-auto my-auto flex w-full max-w-4xl flex-col items-center py-12 text-center">
        {/* Vinyl run-out visual */}
        <div
          aria-hidden="true"
          className="relative mb-8 flex h-32 w-32 items-center justify-center rounded-full border border-[#FFB800]/30 bg-gradient-to-br from-[#16120c] via-[#070707] to-black shadow-[0_0_50px_rgba(255,184,0,0.18)]"
        >
          <div className="absolute inset-3 rounded-full border border-white/10" />
          <div className="absolute inset-6 rounded-full border border-white/10" />
          <div className="absolute inset-9 rounded-full border border-[#FFB800]/25" />
          <Disc3 size={28} className="text-[#FFB800]" />
        </div>

        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#FFB800]">
          Side B · Track not found
        </p>

        <h1 className="mt-4 text-4xl font-black leading-[0.95] tracking-[-0.045em] text-white sm:text-6xl md:text-7xl">
          This track hasn’t dropped yet.{' '}
          <span className="block text-[#FFB800] [text-shadow:0_0_40px_rgba(255,184,0,0.55)]">
            Now what?
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-white/65 md:text-lg">
          The page you looked for isn’t pressed on this side of the record. Pick a clean starting point below and keep moving.
        </p>

        <nav aria-label="Recovery routes" className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className={`${SIGNATURE_BUTTON_BASE} ${gold.button} bg-black/70 px-5 py-3 text-sm`}
          >
            <ArrowLeft size={15} className={gold.icon} aria-hidden="true" />
            <span className={gold.label}>Back to indii.music</span>
            <span aria-hidden="true" className={gold.sweep} />
          </Link>

          <Link
            to="/passport?source=404_recovery"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-[#FFB800]/60 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800]"
          >
            <Compass size={15} className="text-[#FFB800]" aria-hidden="true" />
            Take the Artist Passport
          </Link>

          <a
            href={studioUrl}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-transparent px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800]"
          >
            <LogIn size={15} aria-hidden="true" />
            Sign in to Studio
          </a>
        </nav>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 font-mono text-[11px] text-white/45">
        <span>{INDII_BRAND.name} · {INDII_BRAND.tagline}</span>
        <span>Built in Detroit · © 2026 New Detroit Music LLC</span>
      </footer>
    </div>
  );
}
