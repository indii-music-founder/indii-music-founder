'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { emitSystemPulse } from '../../three/signals';
import { getStudioUrl } from '../../lib/auth';

const founderIncludes = [
  'Permanent top-tier software access',
  'Conductor and connected specialist access',
  'Guided Project White Glove onboarding',
  'First year of included usage allowances',
  'Founding Artist Beta product updates',
  'Permanent Founding Owner recognition',
  'Usage available as needed after included allowances',
];

interface FounderAccessSectionProps {
  trackPreview: (location: string) => void;
}

export default function FounderAccessSection({ trackPreview }: FounderAccessSectionProps) {
  return (
    <section id="founder-access" data-system-section="founder-access" className="relative z-20 w-full overflow-hidden border-t border-amber-400/40 bg-gradient-to-b from-[#0F0A05] via-[#140D06] to-[#0A0704]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,rgba(255,184,0,0.28),rgba(233,30,99,0.08)_40%,transparent_60%)]" />
      <div className="absolute right-[-12rem] top-1/2 h-[42rem] w-[42rem] -translate-y-1/2 rounded-full border border-amber-400/40">
        <div className="absolute inset-[16%] rounded-full border border-amber-400/20" />
        <div className="absolute inset-[34%] rounded-full bg-amber-400/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-5 py-28 md:px-10 md:py-40">
        <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-24">
          <motion.div initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }}>
            <div className="mb-6 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#FFB800] [text-shadow:0_0_12px_rgba(255,184,0,0.6)]">Founding Artist Beta / one-time software license</div>
            <h2 className="text-6xl font-black leading-[0.85] tracking-[-0.065em] text-white sm:text-7xl md:text-9xl lg:text-[10rem]">
              Founding Owner
              <span className="block text-[#FFB800] [text-shadow:0_0_55px_rgba(255,184,0,0.7)]">License.</span>
            </h2>
            <p className="mt-10 max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl">
              Permanent top-tier indii.music software access for one $2,500 purchase. Ongoing metered usage and third-party services are purchased as needed.
              This is software access—not an investment or promise of financial return.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 25 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            className="card-shade-gold relative overflow-hidden rounded-2xl p-8 shadow-[0_30px_90px_rgba(0,0,0,0.9)] backdrop-blur-2xl md:p-10"
          >
            <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold" />
            <div className="flex items-end justify-between border-b border-amber-500/25 pb-7">
              <div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#FFB800]">Founding Owner License</div>
                <div className="mt-2 text-5xl font-black tracking-[-0.055em] text-white [text-shadow:0_0_20px_rgba(255,255,255,0.2)]">$2,500</div>
              </div>
              <div className="rounded-full bg-amber-400/20 px-3.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] font-black text-amber-300 border border-amber-400/50 shadow-[0_0_15px_rgba(255,184,0,0.3)]">One-time purchase</div>
            </div>

            <div className="py-5">
              {founderIncludes.map((item) => (
                <div key={item} className="flex items-center gap-4 border-b border-white/8 py-4 text-sm font-medium text-white/85">
                  <Check size={16} className="text-[#FFB800] drop-shadow-[0_0_10px_rgba(255,184,0,0.8)]" />
                  {item}
                </div>
              ))}
            </div>

            <a
              href="#waitlist"
              onClick={() => {
                trackPreview('founder_access');
                emitSystemPulse('cta', 7, 1);
              }}
              onMouseEnter={() => emitSystemPulse('cta', 7, 0.5)}
              className="group mt-4 inline-flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] px-8 py-5 text-base font-black text-black shadow-[0_0_45px_rgba(255,184,0,0.55)] transition-all hover:scale-[1.02] hover:shadow-[0_0_65px_rgba(255,184,0,0.85)]"
            >
              Get Founding Owner access
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={getStudioUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center justify-center gap-2 text-sm font-bold text-amber-200/80 transition-colors hover:text-white"
            >
              Log in
            </a>
            <p className="mt-5 text-xs leading-relaxed text-white/60">
              Join the waitlist first. Founding Owner access is offered during the beta with limited availability, first come, first served. If you use indii
              for your music business, the purchase may qualify as a business software expense. Tax treatment depends on your circumstances; confirm it with
              your tax professional.
            </p>
          </motion.div>
        </div>

        <div className="mt-20 grid gap-6 border-y border-amber-400/20 py-8 text-sm leading-relaxed text-white/45 md:grid-cols-3">
          <p>
            <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400">What you are buying</span>
            Permanent top-tier software access, guided onboarding, and the Founding Owner benefits listed above.
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
