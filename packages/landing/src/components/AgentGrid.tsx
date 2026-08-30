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
  },
  {
    id: 'repeat',
    index: '08',
    name: 'Repeat',
    label: 'Connected context',
    title: 'Carry what you learned into the next release.',
    outcome:
      'Reuse the project record, approved assets, catalog information, and operating lessons instead of rebuilding your music business from zero every time.',
    details: ['Reusable project context', 'Catalog continuity', 'Next-release starting point'],
    specialists: ['Conductor', 'Catalog', 'Financial Center'],
    route: 'Release Record → Lessons → Reusable Context → Next Release',
  },
];

export default function AgentGrid() {
  const [activeId, setActiveId] = useState('prepare-delivery');
  const active = lifecycle.find((stage) => stage.id === activeId) ?? lifecycle[3];

  return (
    <section id="capabilities" data-system-section="capabilities" className="relative z-20 w-full border-t border-white/10 bg-[#030303]">
      <div className="mx-auto max-w-[1500px] px-5 py-28 md:px-10 md:py-40">
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
              Follow the work from finished music through planning, rights, delivery preparation, campaign, release, and financial tracking. The relevant
              specialists use the same project context at every stage.
            </p>
          </div>
        </motion.div>

        <div className="-mx-5 mt-10 flex overflow-x-auto border-y border-white/10 px-5 no-scrollbar lg:mx-0 lg:grid lg:grid-cols-8 lg:overflow-visible lg:px-0">
          {lifecycle.map((stage) => {
            const isActive = stage.id === active.id;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveId(stage.id)}
                className={`flex min-w-[150px] shrink-0 flex-col items-start gap-1 border-r border-white/10 px-4 py-4 text-left transition-colors lg:min-w-0 ${isActive ? 'bg-amber-400 text-black' : 'text-white/45 hover:bg-white/[0.04] hover:text-white'}`}
                aria-pressed={isActive}
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#080808]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_15%,rgba(245,158,11,0.13),transparent_38%)]" />
              <div className="relative grid lg:grid-cols-[1.2fr_0.8fr]">
                <div className="p-7 md:p-12 lg:p-14">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5 font-mono text-[10px] uppercase tracking-[0.22em]">
                    <span className="flex items-center gap-2 font-bold text-amber-400">
                      <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                      {active.name}
                    </span>
                    <span className="rounded bg-white/10 px-2.5 py-1 font-semibold text-white/70">{active.label}</span>
                  </div>
                  <h3 className="mt-8 max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.04em] text-white md:text-5xl">{active.title}</h3>
                  <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg">{active.outcome}</p>
                  <div className="mt-9 grid gap-3 sm:grid-cols-3">
                    {active.details.map((detail) => (
                      <div key={detail} className="rounded-xl border border-white/10 bg-black/60 p-4">
                        <CheckCircle2 size={16} className="mb-2 text-amber-400" />
                        <div className="text-xs font-semibold leading-snug text-white/80">{detail}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-9 border-t border-white/10 pt-5">
                    <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.25em] text-white/30">Connected path</div>
                    <div className="font-mono text-xs font-semibold leading-relaxed text-amber-300/90">{active.route}</div>
                  </div>
                </div>
                <aside className="flex flex-col justify-between border-t border-white/10 bg-black/55 p-7 md:p-10 lg:border-l lg:border-t-0">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-white/35">Relevant specialists</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {active.specialists.map((specialist) => (
                        <span key={specialist} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/70">
                          {specialist}
                        </span>
                      ))}
                    </div>
                    <p className="mt-5 text-sm leading-relaxed text-white/45">
                      Shared project context keeps this work connected. You review the decisions and remain in control.
                    </p>
                  </div>
                  <div className="mt-12 rounded-xl border border-dashed border-amber-400/35 bg-amber-400/[0.04] p-5">
                    <PlayCircle size={24} className="text-amber-400" />
                    <div className="mt-4 font-mono text-[9px] uppercase tracking-[0.22em] text-amber-400">Real product clip planned</div>
                    <p className="mt-2 text-sm font-semibold text-white">{active.name} / founder walkthrough</p>
                    <p className="mt-2 text-xs leading-relaxed text-white/45">
                      A 15–30 second, click-to-play product capture with captions will appear here during the beta.
                    </p>
                  </div>
                </aside>
              </div>
              <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-7 py-5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/35 md:px-12">
                <span>Finished music → Plan → Register → Prepare delivery → Campaign → Release → Track → Repeat</span>
                <a href="#conductor" className="inline-flex items-center gap-2 font-bold text-amber-400 transition-colors hover:text-amber-300">
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
