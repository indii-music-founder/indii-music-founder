'use client';

import React from 'react';
import { INDII_BRAND } from '@shared/brand';

interface FooterSectionProps {
  founder: boolean;
  onContactClick: () => void;
}

export default function FooterSection({ founder, onContactClick }: FooterSectionProps) {
  return (
    <footer data-system-section="footer" className="relative z-20 w-full overflow-hidden border-t border-white/10 bg-black">
      <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,184,0,0.06),transparent_70%)]" />
      <div className="relative mx-auto flex max-w-[1500px] flex-col gap-10 px-5 py-12 md:flex-row md:items-end md:justify-between md:px-10 md:py-16">
        <div>
          <div className="text-2xl font-black tracking-[-0.04em] text-white transition-all hover:text-[#FFB800] hover:[text-shadow:0_0_20px_rgba(255,184,0,0.7)] cursor-default">indii.music</div>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
            {INDII_BRAND.tagline}
            <br />
            Built in Detroit.
          </p>
          <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">© 2026 New Detroit Music LLC</p>
        </div>
        <div className="flex flex-wrap gap-6 font-mono text-[9px] uppercase tracking-[0.18em] text-white/50">
          <a href="/privacy" className="py-1 transition-colors hover:text-white">Privacy</a>
          <a href="/terms" className="py-1 transition-colors hover:text-white">Terms</a>
          {founder && (
            <a
              href="mailto:wiil@indii.music"
              onClick={(event) => {
                event.preventDefault();
                onContactClick();
              }}
              className="py-1 font-bold text-[#FFB800] transition-colors hover:text-amber-300 [text-shadow:0_0_10px_rgba(255,184,0,0.5)]"
            >
              Contact <span className="wiil-name">wiil</span>
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
