'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { emitSystemPulse } from '../../three/signals';

const founderIncludes = [
  'Lifetime access to the Founder edition',
  'Boardroom and Conductor access',
  'Guided Project White Glove onboarding',
  'First year of API usage included',
  'Founder-level product updates',
  'Permanent founder recognition',
  'No recurring platform subscription',
];

interface FounderAccessSectionProps {
  studioUrl: string;
  trackPreview: (location: string) => void;
}

export default function FounderAccessSection({ studioUrl, trackPreview }: FounderAccessSectionProps) {
  return (
    <section id="founder-access" data-system-section="founder-access" className="relative z-20 w-full overflow-hidden border-t border-amber-400/25 bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,rgba(245,158,11,0.18),transparent_34%)]" />
      <div className="absolute right-[-12rem] top-1/2 h-[42rem] w-[42rem] -translate-y-1/2 rounded-full border border-amber-400/20">
        <div className="absolute inset-[16%] rounded-full border border-white/[0.06]" />
        <div className="absolute inset-[34%] rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-5 py-28 md:px-10 md:py-40">
        <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-24">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
          >
            <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
              Private founder release / software access
            </div>
            <h2 className="text-6xl font-black leading-[0.85] tracking-[-0.065em] text-white sm:text-7xl md:text-9xl lg:text-[10rem]">
              Your seat is
              <span className="block text-amber-400">waiting.</span>
            </h2>
            <p className="mt-10 max-w-2xl text-lg leading-relaxed text-white/55 md:text-xl">
              Founder Access is a one-time purchase of enterprise software access. It is not an investment, security, ownership interest, or promise of financial return. Any future investment or strategic participation is a separate conversation.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            className="border-t border-white/15 pt-7"
          >
            <div className="flex items-end justify-between border-b border-white/10 pb-7">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">One-time purchase</div>
                <div className="mt-2 text-5xl font-black tracking-[-0.055em] text-white">$2,500</div>
              </div>
              <div className="pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-amber-400">Founder edition</div>
            </div>

            <div className="py-5">
              {founderIncludes.map((item) => (
                <div key={item} className="flex items-center gap-4 border-b border-white/8 py-4 text-sm text-white/65">
                  <Check size={14} className="text-amber-400" />
                  {item}
                </div>
              ))}
            </div>

            <a
              href={studioUrl}
              rel="noopener noreferrer"
              onClick={() => {
                trackPreview('founder_access');
                emitSystemPulse('cta', 7, 1);
              }}
              onMouseEnter={() => emitSystemPulse('cta', 7, 0.5)}
              className="group mt-4 inline-flex w-full items-center justify-center gap-3 rounded-full bg-amber-400 px-8 py-5 text-base font-black text-black shadow-[0_0_40px_rgba(245,158,11,0.25)] transition-transform hover:scale-[1.02]"
            >
              Secure Founder Access
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </a>
            <p className="mt-5 text-xs leading-relaxed text-white/50">
              If you use indii for your music business, the purchase may qualify as a business software expense. Tax treatment depends on your circumstances; confirm it with your tax professional.
            </p>
          </motion.div>
        </div>

        <div className="mt-20 grid gap-6 border-y border-amber-400/20 py-8 text-sm leading-relaxed text-white/45 md:grid-cols-3">
          <p>
            <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400">What you are buying</span>
            Software access, guided onboarding, and the founder release benefits listed above.
          </p>
          <p>
            <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400">What you are not buying</span>
            Equity, profit participation, a security, or any right to a financial return.
          </p>
          <p>
            <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400">Separate conversations</span>
            Any future investment or strategic participation would require its own written agreement.
          </p>
        </div>
      </div>
    </section>
  );
}
