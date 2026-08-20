'use client';

import React from 'react';
import { INDII_BRAND } from '@shared/brand';

interface FooterSectionProps {
  founder: boolean;
  onContactClick: () => void;
}

export default function FooterSection({ founder, onContactClick }: FooterSectionProps) {
  return (
    <footer data-system-section="footer" className="relative z-20 w-full border-t border-white/10 bg-[#030303]">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-10 px-5 py-12 md:flex-row md:items-end md:justify-between md:px-10 md:py-16">
        <div>
          <div className="text-2xl font-black tracking-[-0.04em] text-white">indii.music</div>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/50">
            {INDII_BRAND.tagline}
            <br />
            Built in Detroit.
          </p>
          <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">© 2026 New Detroit Music LLC</p>
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
              className="py-1 text-amber-400 transition-colors hover:text-amber-300"
            >
              Contact <span className="wiil-name">wiil</span>
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
