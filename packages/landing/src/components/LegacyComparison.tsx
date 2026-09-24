'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, ArrowRight, BookOpen, Users, Palette, Zap } from 'lucide-react';

interface BreakthroughPillar {
  number: string;
  title: string;
  tagline: string;
  hex: string;
  Icon: React.ElementType;
  genericLabel: string;
  generic: string;
  indiiLabel: string;
  indii: string;
  proof: string;
}

const breakthroughPillars: BreakthroughPillar[] = [
  {
    number: '01',
    title: 'Your Living Master Directive',
    tagline: 'Your studio rules. Enforced by default.',
    hex: '#FFB800',
    Icon: BookOpen,
    genericLabel: 'Generic software',
    generic:
      'Most tools forget who you are between sessions. You re-explain your sound, your contract red lines, and your aesthetic to every tool, every time.',
    indiiLabel: 'Your Master Directive',
    indii:
      'Set your minimum royalty splits, target loudness, and visual style once in your Living Playbook. Your dedicated team never deviates from your standards—and updates itself automatically as you work.',
    proof: 'Learns your preferences automatically as you work',
  },
  {
    number: '02',
    title: 'Your 23-Piece Dedicated Team',
    tagline: 'Real domain expertise. Not a general chatbot.',
    hex: '#00B8D4',
    Icon: Users,
    genericLabel: 'One confused chatbot',
    generic:
      'A general-purpose chatbot guessing at copyright law, aesthetic direction, and campaign strategy simultaneously—producing generic results that can harm your brand.',
    indiiLabel: 'Your dedicated specialists',
    indii:
      'When you ask a legal question, a legal specialist answers. When you need a campaign, a marketing specialist handles it. 23 domain-isolated members of your team—each trained only on their area of expertise.',
    proof: 'Domain expertise, not general guessing',
  },
  {
    number: '03',
    title: 'Instant Brand Sync',
    tagline: 'Update once. Everything updates.',
    hex: '#00FF66',
    Icon: Palette,
    genericLabel: 'Manual updates across every tool',
    generic:
      'Change your brand palette and spend hours updating your studio interface, campaign visuals, merchandise concepts, and social templates across a dozen separate apps.',
    indiiLabel: 'Unified Visual Identity',
    indii:
      'Update your colors once in your Master Directive and your entire studio, social teasers, and merchandise concepts update automatically in seconds. Your design specialists get the new brief instantly.',
    proof: 'One change. Full studio. Instant cascade.',
  },
  {
    number: '04',
    title: 'Intelligence in the Foundation',
    tagline: 'Music business at the speed of you.',
    hex: '#E040FB',
    Icon: Zap,
    genericLabel: 'A disconnected chat window',
    generic:
      'Traditional tools glue a chatbot to the corner of an old website. You wait for generic paragraphs while your actual splits, statements, and releases stay stuck in slow web forms.',
    indiiLabel: 'Built-In Common Sense',
    indii:
      'Common sense is woven directly into your tools. Statement audits, split contracts, and release packaging happen in milliseconds without slowing down your session.',
    proof: 'Everything in one room. Zero waiting.',
  },
];

export default function LegacyComparison() {
  return (
    <section
      id="legacy-shift"
      data-system-section="legacy"
      className="relative z-20 w-full border-t border-white/10 bg-black py-28 md:py-40"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,184,0,0.07),transparent_55%)]" />

      <div className="relative mx-auto max-w-[1500px] px-5 md:px-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-white/[0.03] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400 shadow-[0_0_15px_rgba(255,184,0,0.15)]">
            Four core breakthroughs
          </div>

          <h2 className="mt-6 text-4xl font-black leading-tight tracking-[-0.05em] text-white sm:text-6xl md:text-7xl">
            Stop explaining your brand{' '}
            <span className="text-amber-400 [text-shadow:0_0_30px_rgba(255,184,0,0.35)]">to generic software.</span>
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-white/60 md:text-xl">
            Every major label artist has a team of 20 people handling contracts, distribution, visual campaigns, and strategy.
            Independent artists have had to do it alone—until now.
          </p>
        </motion.div>

        {/* Breakthrough Cards — 4-column grid */}
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {breakthroughPillars.map((pillar, index) => (
            <motion.div
              key={pillar.number}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: index * 0.12, duration: 0.65 }}
              className="lacquer-card relative flex flex-col overflow-hidden rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] backdrop-blur-xl transition-all duration-300 hover:scale-[1.015] hover:border-amber-400/40"
            >
              <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold" />

              {/* Card Header */}
              <div className="border-b border-white/10 px-7 py-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[10px] font-black uppercase tracking-[0.28em] text-[#FFB800]">
                        {pillar.number}
                      </span>
                      <pillar.Icon
                        size={13}
                        style={{ color: pillar.hex }}
                      />
                    </div>
                    <h3 className="mt-2 text-lg font-black leading-tight tracking-tight text-white">
                      {pillar.title}
                    </h3>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                      {pillar.tagline}
                    </p>
                  </div>
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: pillar.hex,
                      boxShadow: `0 0 10px ${pillar.hex}`,
                    }}
                  />
                </div>
              </div>

              {/* Generic vs indii comparison */}
              <div className="flex flex-1 flex-col gap-3 p-7">
                {/* Generic panel */}
                <div className="rounded-xl border border-white/10 bg-black/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-red-400/80">
                    <ShieldAlert size={11} />
                    {pillar.genericLabel}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-white/65">{pillar.generic}</p>
                </div>

                {/* indii panel */}
                <div className="rounded-xl border border-amber-400/25 bg-black/80 p-4 shadow-[inset_0_1px_0_rgba(255,215,0,0.08),0_0_18px_rgba(255,184,0,0.05)]">
                  <div className="flex items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-[#FFB800]">
                    <ShieldCheck size={11} />
                    {pillar.indiiLabel}
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-white/95">{pillar.indii}</p>
                </div>
              </div>

              {/* Proof line */}
              <div className="border-t border-white/10 px-7 py-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#FFB800]/80">
                  {pillar.proof}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Elevator pitch banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lacquer-card-gold relative mt-14 overflow-hidden rounded-2xl p-8 shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-12"
        >
          <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold" />
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xl font-black leading-snug tracking-tight text-white md:text-3xl">
              Set your studio rules, sound standards, and brand style in your Master Directive.
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
              Your 23-piece team executes everything around the clock—distribution, marketing, legal work, and visual campaigns—without you repeating yourself.
            </p>
            <span className="mt-5 block text-lg font-black text-[#FFB800] [text-shadow:0_0_25px_rgba(255,184,0,0.5)] sm:text-xl">
              Music business at the speed of you.
            </span>
          </div>
          <div className="mt-8 flex justify-center">
            <a
              href="#studio-preview"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#E65100] px-8 py-3.5 text-xs font-black uppercase tracking-wider text-black shadow-[0_0_30px_rgba(255,184,0,0.5),0_0_45px_rgba(229,57,53,0.3)] transition-all hover:scale-[1.03] hover:shadow-[0_0_45px_rgba(255,184,0,0.75),0_0_60px_rgba(229,57,53,0.5)]"
            >
              <span>Explore the Studio Workspace</span>
              <ArrowRight size={14} />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
