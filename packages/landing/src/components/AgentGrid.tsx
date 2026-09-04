'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, PlayCircle, Shield } from 'lucide-react';

interface LifecycleStage {
  id: string;
  index: string;
  name: string;
  label: string;
  title: string;
  outcome: string;
  details: string[];
  specialists: string[];
  route: string;
  hex: string;
  glow: string;
  accentClass: string;
  badgeBg: string;
}

const lifecycle: LifecycleStage[] = [
  {
    id: 'finished-music',
    index: '01',
    name: 'Finished music',
    label: 'Starting point',
    title: 'Start with the finished music and the facts around it.',
    outcome: 'Bring the master, artwork, credits, contributors, and release intent into one project so the next steps begin with shared context.',
    details: ['Finished master', 'Credits and contributors', 'One release record'],
    specialists: ['Audio Intelligence', 'Catalog'],
    route: 'Finished Master → Project Context → Release Record',
    hex: '#00BCD4',
    glow: 'rgba(0, 188, 212, 0.25)',
    accentClass: 'text-[#00BCD4]',
    badgeBg: 'bg-[#00BCD4]/10 border-[#00BCD4]/30 text-[#00BCD4]',
  },
  {
    id: 'plan',
    index: '02',
    name: 'Plan',
    label: 'Release planning',
    title: 'Keep dates, tasks, assets, and approvals together.',
    outcome: 'Turn the release goal into visible work. Everyone involved can see what is due, what is blocked, and what still needs artist approval.',
    details: ['Release dates', 'Tasks and owners', 'Approval checkpoints'],
    specialists: ['Conductor', 'Release Planning'],
    route: 'Release Goal → Timeline → Tasks → Artist Approval',
    hex: '#FFB800',
    glow: 'rgba(255, 184, 0, 0.25)',
    accentClass: 'text-[#FFB800]',
    badgeBg: 'bg-[#FFB800]/10 border-[#FFB800]/30 text-[#FFB800]',
  },
  {
    id: 'register',
    index: '03',
    name: 'Register',
    label: 'Rights and records',
    title: 'Know what you own and what still needs to be registered.',
    outcome: 'Keep composition information, master ownership, songwriter splits, credits, and registration status attached to the music they describe.',
    details: ['Ownership records', 'Split information', 'Registration status'],
    specialists: ['Rights & Legal', 'Publishing'],
    route: 'Credits → Ownership → Split Check → Registration Status',
    hex: '#009688',
    glow: 'rgba(0, 150, 136, 0.25)',
    accentClass: 'text-[#009688]',
    badgeBg: 'bg-[#009688]/10 border-[#009688]/30 text-[#009688]',
  },
  {
    id: 'prepare-delivery',
    index: '04',
    name: 'Prepare delivery',
    label: 'Featured workflow',
    title: 'Prepare releases and delivery-ready packages.',
    outcome:
      'Bring mastered audio, artwork, credits, rights information, identifiers, and release metadata together before the package moves to the next approved delivery step.',
    details: ['DDEX ERN 4.3 preparation', 'Identifier and metadata checks', 'Delivery-ready release record'],
    specialists: ['Delivery Preparation', 'Rights & Legal', 'Audio Intelligence'],
    route: 'Mastered Audio → Release Metadata → Schema Verification → Delivery-Ready Package',
    hex: '#2196F3',
    glow: 'rgba(33, 150, 243, 0.25)',
    accentClass: 'text-[#2196F3]',
    badgeBg: 'bg-[#2196F3]/10 border-[#2196F3]/30 text-[#2196F3]',
  },
  {
    id: 'campaign',
    index: '05',
    name: 'Campaign',
    label: 'Creative workflow',
    title: 'Turn finished music into a coordinated visual campaign.',
    outcome: 'Build artwork, short-form video, campaign copy, and channel-ready assets from the same music, visual identity, release plan, and approvals.',
    details: ['Connected visual direction', 'Campaign asset set', 'Artist-reviewed outputs'],
    specialists: ['Creative Director', 'Marketing Strategy', 'Social Media'],
    route: 'Music + Brand → Visual Direction → Campaign Assets → Review',
    hex: '#E91E63',
    glow: 'rgba(233, 30, 99, 0.25)',
    accentClass: 'text-[#E91E63]',
    badgeBg: 'bg-[#E91E63]/10 border-[#E91E63]/30 text-[#E91E63]',
  },
  {
    id: 'release',
    index: '06',
    name: 'Release',
    label: 'Approved action',
    title: 'Move the approved release plan into action.',
    outcome:
      'Keep the final package, campaign schedule, approvals, and release-day responsibilities visible while each external action remains under artist control.',
    details: ['Final package review', 'Release-day checklist', 'Recorded approvals'],
    specialists: ['Conductor', 'Delivery Preparation', 'Marketing Strategy'],
    route: 'Final Review → Approved Actions → Release-Day Record',
    hex: '#FF5722',
    glow: 'rgba(255, 87, 34, 0.25)',
    accentClass: 'text-[#FF5722]',
    badgeBg: 'bg-[#FF5722]/10 border-[#FF5722]/30 text-[#FF5722]',
  },
  {
    id: 'track',
    index: '07',
    name: 'Track',
    label: 'Financial workflow',
    title: 'Track income, expenses, and splits together.',
    outcome:
      'Keep reported revenue, project costs, collaborator splits, and release activity connected so the business picture does not live in scattered spreadsheets.',
    details: ['Income records', 'Project expenses', 'Split tracking'],
    specialists: ['Financial Center', 'Rights & Royalties'],
    route: 'Income + Expenses → Split Records → Project Summary',
    hex: '#FFC107',
    glow: 'rgba(255, 193, 7, 0.25)',
    accentClass: 'text-[#FFC107]',
    badgeBg: 'bg-[#FFC107]/10 border-[#FFC107]/30 text-[#FFC107]',
  },
  {
    id: 'repeat',
    index: '08',
    name: 'Repeat',
    label: 'Connected context',
    title: 'Carry what you learned into the next release.',
    outcome:
      'Reuse the project record, approved assets, catalog information, and operating lessons instead of rebuilding your music business from zero every time. Connected Intelligence© ensures every release builds upon the last.',
    details: ['Reusable project context', 'Catalog continuity', 'Next-release starting point'],
    specialists: ['Conductor', 'Catalog', 'Financial Center'],
    route: 'Release Record → Lessons → Reusable Context → Next Release',
    hex: '#8BC34A',
    glow: 'rgba(139, 195, 74, 0.25)',
    accentClass: 'text-[#8BC34A]',
    badgeBg: 'bg-[#8BC34A]/10 border-[#8BC34A]/30 text-[#8BC34A]',
  },
];

export default function AgentGrid() {
  const [activeId, setActiveId] = useState('prepare-delivery');
  const active = lifecycle.find((stage) => stage.id === activeId) ?? lifecycle[3];

  return (
    <section id="capabilities" data-system-section="capabilities" className="relative z-20 w-full overflow-hidden border-t border-white/10 bg-black">
      {/* Subtle Studio Glow Background */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          background: 'radial-gradient(circle at 50% 25%, rgba(255,184,0,0.06), transparent 55%)',
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 blur-[160px] transition-all duration-700 opacity-40"
        style={{
          backgroundColor: 'rgba(255,184,0,0.04)',
        }}
      />

      <div className="relative mx-auto max-w-[1500px] px-5 py-28 md:px-10 md:py-40">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-10 border-b border-white/10 pb-16 lg:grid-cols-[0.65fr_1.35fr]"
        >
          <div>
            <div className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-amber-400">
              <Shield size={14} />
              The release lifecycle
            </div>
            <div className="font-mono text-xs uppercase leading-relaxed tracking-[0.18em] text-white/40">
              Finished music to the next release
              <br />
              One artist-controlled project
            </div>
          </div>
          <div>
            <h2 className="max-w-5xl text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-6xl md:text-8xl lg:text-[7.5rem]">
              Run the whole release.
              <span className="block text-amber-400">Keep the context connected.</span>
            </h2>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/60 md:text-xl">
              Follow the work from finished music through planning, rights, delivery preparation, campaign, release, and financial tracking. Powered by Connected Intelligence©,
              the relevant specialists use the same project context at every stage.
            </p>
          </div>
        </motion.div>

        <div
          role="tablist"
          aria-label="Release lifecycle stages"
          className="-mx-5 mt-10 flex overflow-x-auto border-y border-white/10 px-5 no-scrollbar lg:mx-0 lg:grid lg:grid-cols-8 lg:overflow-visible lg:px-0"
        >
          {lifecycle.map((stage) => {
            const isActive = stage.id === active.id;
            return (
              <button
                key={stage.id}
                type="button"
                role="tab"
                id={`tab-${stage.id}`}
                aria-controls={`panel-${stage.id}`}
                aria-selected={isActive}
                aria-pressed={isActive}
                onClick={() => setActiveId(stage.id)}
                style={isActive ? { borderTopColor: stage.hex, backgroundColor: 'rgba(255,255,255,0.05)' } : {}}
                className={`flex min-w-[150px] shrink-0 flex-col items-start gap-1 border-r border-white/10 px-4 py-4 text-left transition-all duration-300 lg:min-w-0 ${
                  isActive
                    ? 'border-t-2 font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                    : 'text-white/45 hover:bg-white/[0.03] hover:text-white'
                }`}
                aria-label={`${stage.name}: ${stage.title}`}
              >
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]">{stage.index}</span>
                <span className="text-sm font-bold leading-tight">{stage.name}</span>
              </button>
            );
          })}
        </div>

        <div className="pt-10 lg:pt-14">
          <AnimatePresence mode="wait">
            <motion.article
              key={active.id}
              role="tabpanel"
              id={`panel-${active.id}`}
              aria-labelledby={`tab-${active.id}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="lacquer-card relative overflow-hidden rounded-2xl shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
            >
              <div
                className="absolute inset-x-0 top-0 h-[1px] specular-line-gold"
              />
              <div className="relative grid lg:grid-cols-[1.2fr_0.8fr]">
                <div className="p-7 md:p-12 lg:p-14">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5 font-mono text-[10px] uppercase tracking-[0.22em]">
                    <span className="flex items-center gap-2 font-bold text-white">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: active.hex, boxShadow: `0 0 8px ${active.hex}` }}
                      />
                      {active.name}
                    </span>
                    <span className="rounded-full bg-white/[0.04] px-3 py-1 font-semibold text-white/70 border border-white/10">{active.label}</span>
                  </div>
                  <h3 className="mt-8 max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.04em] text-white md:text-5xl">{active.title}</h3>
                  <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">{active.outcome}</p>
                  <div className="mt-9 grid gap-3 sm:grid-cols-3">
                    {active.details.map((detail) => (
                      <div
                        key={detail}
                        className="rounded-xl border border-white/10 bg-black/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 hover:border-white/20"
                      >
                        <CheckCircle2 size={16} className="mb-2 text-[#FFB800]" />
                        <div className="text-xs font-bold leading-snug text-white/90">{detail}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-9 border-t border-white/10 pt-5">
                    <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">Connected path</div>
                    <div className="font-mono text-xs font-semibold leading-relaxed text-amber-300/90">{active.route}</div>
                  </div>
                </div>
                <aside className="flex flex-col justify-between border-t border-white/10 bg-black/75 p-7 md:p-10 lg:border-l lg:border-t-0">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/50">Relevant specialists</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {active.specialists.map((specialist) => (
                        <span
                          key={specialist}
                          className="rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_0_12px_rgba(0,0,0,0.4)] transition-colors hover:border-amber-400/40"
                        >
                          {specialist}
                        </span>
                      ))}
                    </div>
                    <p className="mt-5 text-sm leading-relaxed text-white/60">
                      Shared project context keeps this work connected. Powered by Connected Intelligence©, what you decide with one specialist is immediately known by the next.
                    </p>
                  </div>
                  <div
                    className="mt-12 rounded-xl border border-white/15 bg-black/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <PlayCircle size={28} className="text-[#FFB800] drop-shadow-[0_0_10px_rgba(255,184,0,0.4)]" />
                    <div className="mt-4 font-mono text-[9px] uppercase font-bold tracking-[0.22em] text-[#FFB800]">Real product clip planned</div>
                    <p className="mt-2 text-sm font-black text-white">{active.name} / founder walkthrough</p>
                    <p className="mt-2 text-xs leading-relaxed text-white/60">
                      A 15–30 second, click-to-play product capture with captions will appear here during the beta.
                    </p>
                  </div>
                </aside>
              </div>
              <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-7 py-5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/50 md:px-12">
                <span>Finished music → Plan → Register → Prepare delivery → Campaign → Release → Track → Repeat</span>
                <a href="#conductor" className="inline-flex items-center gap-2 font-bold text-[#FFB800] [text-shadow:0_0_10px_rgba(255,184,0,0.5)] transition-colors hover:text-amber-300">
                  See how Conductor connects it
                  <ArrowRight size={13} />
                </a>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
