'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, CheckCircle2, Shield } from 'lucide-react';

interface Workstream {
  id: string;
  index: string;
  name: string;
  title: string;
  outcome: string;
  details: string[];
  route: string;
  badge: string;
}

const workstreams: Workstream[] = [
  {
    id: 'distribution',
    index: '01',
    name: 'Delivery Preparation',
    badge: 'Delivery Ready',
    title: 'Prepare releases and delivery-ready packages.',
    outcome:
      'Bring mastered audio, artwork, credits, rights information, identifiers, and DDEX metadata together before a release leaves the project.',
    details: ['DDEX ERN 4.3 Preparation', 'Identifier & Metadata Checks', 'Delivery-Ready Release Record'],
    route: 'Mastered Audio → Release Metadata → Schema Verification → Delivery-Ready Package',
  },
  {
    id: 'music',
    index: '02',
    name: 'Audio Intelligence',
    badge: 'Sonic DNA',
    title: 'Turn finished audio into shared project context.',
    outcome:
      'Extract useful metadata from the finished master so the relevant release, campaign, and catalog workflows begin with the same source context.',
    details: ['Agent Context Baseline', 'Sonic DNA Metadata', 'Multi-Specialist Alignment'],
    route: 'Audio Upload → Sonic DNA Extraction → Agent Specialist Baseline → Release Pipeline',
  },
  {
    id: 'creative',
    index: '03',
    name: 'Creative Director',
    badge: '4K Visual Studio',
    title: 'Unify all release visual assets in one workspace.',
    outcome:
      'Whether you import assets from outside creative teams or generate 4K artwork and visualizers in the app, every visual asset sits unified in your release pipeline.',
    details: ['External Asset Import', 'In-App 4K Generation', 'Unified Visual Pipeline'],
    route: 'Sound Profile → Visual Concept → Render & Canvas → Approval',
  },
  {
    id: 'brand',
    index: '04',
    name: 'Brand Manager',
    badge: 'Identity Guard',
    title: 'Lock in your visual identity & tone of voice.',
    outcome:
      'Define Brand Bibles, typography hierarchies, color palettes, and copywriting rules. Audit every output with 0-100 brand consistency scores.',
    details: ['Brand Bible Blueprint', 'Typography & Palette Control', '0-100 Consistency Scoring'],
    route: 'Artist Voice → Identity Guardrails → Audited Output',
  },
  {
    id: 'rights',
    index: '05',
    name: 'Rights & Legal',
    badge: 'Rights Protection',
    title: 'Protect your rights and own your masters from day one.',
    outcome:
      'Keep songwriter splits, copyright-registration status, credits, and master ownership attached to the project they describe.',
    details: ['Ownership Records', 'Split Information', 'Copyright & Registration Tracking'],
    route: 'Credits → Split Information → Registration Status → Catalog Record',
  },
  {
    id: 'finance',
    index: '06',
    name: 'Financial Center',
    badge: 'Income & Outflow',
    title: 'Track every dollar coming in and every dollar going out.',
    outcome:
      'Track streaming, sync, and merchandise income alongside collaborator splits and project expenses without separating the money from the release.',
    details: ['Income Tracking', 'Split Records', 'Project Expenses'],
    route: 'Income Records → Split Information → Expense Ledger → Project Summary',
  },
  {
    id: 'marketing',
    index: '07',
    name: 'Marketing Strategy',
    badge: 'Waterfall Campaigns',
    title: 'Execute high-impact release rollouts.',
    outcome:
      'Structure waterfall single rollouts, pre-save momentum campaigns, ad budget allocations, and editorial pitching for maximum reach.',
    details: ['Waterfall Rollout Plans', '500-Char DSP Pitch Drafts', 'Ad Budget Optimization'],
    route: 'Release Goal → Campaign Strategy → Multi-Channel Rollout',
  },
  {
    id: 'social',
    index: '08',
    name: 'Social Media',
    badge: 'Funnel-Connected',
    title: 'Connected social content generated directly from your release funnel.',
    outcome:
      'Because your songs, brand bible, audio DNA, and marketing rollout sit in the exact same workspace, social media concepts and announcements flow naturally directly out of your active release funnel.',
    details: ['Funnel-Connected Assets', 'Brand & Song Context', 'Direct Release Pipeline'],
    route: 'Release Funnel → Content Drafts → Artist Review → Scheduled Output',
  },
  {
    id: 'publishing',
    index: '09',
    name: 'Publishing',
    badge: 'Composition Rights',
    title: 'Know what should be registered and what still needs attention.',
    outcome:
      'Organize composition metadata and registration status in one place so accurate records are ready for the appropriate publishing and rights organizations.',
    details: ['Composition Metadata', 'Registration Status', 'Publishing Records'],
    route: 'Composition Metadata → Registration Check → Prepared Records → Status Tracking',
  },
  {
    id: 'licensing',
    index: '10',
    name: 'Sync & Licensing',
    badge: 'Sync Ready',
    title: 'Prepare your catalog for TV, film & gaming pitches.',
    outcome:
      'Organize instrumentals, stems, sync briefs, and one-stop clearance metadata so you can pitch immediately when opportunities arise.',
    details: ['Stem & Instrumental Vault', 'One-Stop Clearance Tags', 'Sync Brief Matching'],
    route: 'Opportunity → Filtered Catalog → Pitch Package Sent',
  },
  {
    id: 'publicist',
    index: '11',
    name: 'Publicity & PR',
    badge: 'EPK & Press',
    title: 'Keep publicity materials connected to current project facts.',
    outcome:
      'Use current songs, dates, milestones, and brand material to prepare EPK and publicity updates from the same project source.',
    details: ['Current Project Facts', 'EPK Preparation', 'Publicity Materials'],
    route: 'Project Facts → EPK Update → Artist Review → Outreach Preparation',
  },
  {
    id: 'road',
    index: '12',
    name: 'Road Manager',
    badge: 'Touring & Mileage',
    title: 'Coordinate tours, show logistics, and mileage records.',
    outcome:
      'Manage venue contracts, day-of-show schedules, tour routing, and business mileage records across every gig so travel activity stays visible.',
    details: ['Tour Mileage & Expense Tracking', 'Venue & Day-of-Show Schedules', 'Show Revenue & Per-Diem Accounting'],
    route: 'Booked Date → Mileage & Route Optimization → Day-of-Show Itinerary → Settlement',
  },
  {
    id: 'merchandise',
    index: '13',
    name: 'Merch & Store',
    badge: 'Physical Products',
    title: 'Turn visual identity into physical merchandise.',
    outcome:
      'Design apparel, vinyl mockups, and physical products connected directly to your album art and brand kit.',
    details: ['Apparel & Vinyl Mockups', 'Direct Store Integration', 'Margin & Profit Analytics'],
    route: 'Visual Identity → Product Design → E-Commerce Store',
  },
  {
    id: 'security',
    index: '14',
    name: 'Control & Security',
    badge: 'Full Oversight',
    title: 'High-impact actions stay visible and reviewable.',
    outcome:
      'Review proposed high-impact work, important assets, financial actions, and external-release steps before they move forward.',
    details: ['Artist Review', 'Protected Master Storage', 'Recorded Actions'],
    route: 'Specialist Proposal → Risk-Aware Review → Recorded Action',
  },
  {
    id: 'conductor',
    index: '15',
    name: 'Conductor',
    badge: 'System Coordinator',
    title: 'One plain-language request coordinates the relevant work.',
    outcome:
      'Tell indii what you want to achieve. Conductor orchestrates the departments, breaks down complex workflows, and presents clear results.',
    details: ['Multi-Specialist Orchestration', 'Plain English Directives', 'Unified Project State'],
    route: 'Artist Intent → Conductor Plan → Relevant Specialists → Artist Review',
  },
];

export default function AgentGrid() {
  const [activeId, setActiveId] = useState(workstreams[0].id);
  const active = workstreams.find((workstream) => workstream.id === activeId) ?? workstreams[0];

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
              The Operating System
            </div>
            <div className="font-mono text-xs uppercase leading-relaxed tracking-[0.18em] text-white/40">
              Connected Music-Business Workflows
              <br />
              One Artist-Controlled Workspace
            </div>
          </div>
          <div>
            <h2 className="max-w-5xl text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-6xl md:text-8xl lg:text-[7.5rem]">
              Every part of the work.
              <span className="block text-amber-400">Connected to the same project.</span>
            </h2>
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/60 md:text-xl">
              Independent artists carry release, rights, campaign, and financial work across disconnected tools. See how indii.music keeps the relevant work connected in one artist-controlled workspace.
            </p>
          </div>
        </motion.div>

        {/* Mobile Horizontal Selector */}
        <div className="-mx-5 mt-10 flex gap-0 overflow-x-auto border-y border-white/10 px-5 no-scrollbar lg:hidden">
          {workstreams.map((workstream) => {
            const isActive = workstream.id === active.id;
            return (
              <button
                key={workstream.id}
                type="button"
                onClick={() => setActiveId(workstream.id)}
                className={`flex shrink-0 items-center gap-2 border-r border-white/10 px-4 py-4 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors ${
                  isActive ? 'bg-amber-400 text-black font-bold' : 'text-white/40'
                }`}
                aria-pressed={isActive}
                aria-label={`${workstream.name}: ${workstream.title}`}
              >
                <span>{workstream.index}</span>
                <span>{workstream.name}</span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-12 pt-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:pt-12">
          {/* Desktop Left Department List */}
          <div className="hidden border-t border-white/10 lg:block max-h-[720px] overflow-y-auto pr-2 no-scrollbar">
            {workstreams.map((workstream) => {
              const isActive = workstream.id === active.id;
              return (
                <button
                  key={workstream.id}
                  type="button"
                  onClick={() => setActiveId(workstream.id)}
                  className={`group flex w-full items-center gap-4 border-b px-3 py-4 text-left transition-all ${
                    isActive
                      ? 'border-amber-400/60 bg-amber-400/[0.06] text-white pl-4'
                      : 'border-white/8 text-white/40 hover:border-white/20 hover:text-white/80'
                  }`}
                  aria-pressed={isActive}
                  aria-label={`${workstream.name}: ${workstream.title}`}
                >
                  <span className={`font-mono text-[10px] tracking-[0.2em] ${isActive ? 'text-amber-400 font-bold' : 'text-white/40'}`}>
                    {workstream.index}
                  </span>
                  <span className="flex-1 text-base font-bold tracking-tight md:text-lg">{workstream.name}</span>
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                    isActive ? 'bg-amber-400 text-black font-bold' : 'bg-white/5 text-white/45'
                  }`}>
                    {workstream.badge}
                  </span>
                  <ArrowUpRight
                    size={16}
                    className={`transition-transform ${isActive ? 'translate-x-0 text-amber-400' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right Active Department Card */}
          <div className="lg:sticky lg:top-28 lg:h-fit">
            <AnimatePresence mode="wait">
              <motion.article
                key={active.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="relative min-h-[500px] overflow-hidden rounded-2xl border border-white/15 bg-[#080808] p-8 md:min-h-[540px] md:p-12"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(245,158,11,0.12),transparent_40%)]" />
                <div className="absolute -right-8 -top-16 select-none font-mono text-[16rem] font-black leading-none text-white/[0.02]">
                  {active.index}
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between border-b border-white/10 pb-5 font-mono text-[10px] uppercase tracking-[0.24em]">
                    <span className="text-amber-400 font-bold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                      {active.name}
                    </span>
                    <span className="rounded bg-white/10 px-2.5 py-1 text-white/70 font-semibold">{active.badge}</span>
                  </div>

                  <h3 className="mt-8 max-w-3xl text-3xl font-black leading-[1.05] tracking-[-0.04em] text-white md:text-5xl">
                    {active.title}
                  </h3>
                  <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg">
                    {active.outcome}
                  </p>

                  <div className="mt-10 grid gap-3 sm:grid-cols-3">
                    {active.details.map((detail) => (
                      <div key={detail} className="rounded-xl border border-white/10 bg-black/60 p-4">
                        <CheckCircle2 size={16} className="mb-2 text-amber-400" />
                        <div className="text-xs font-semibold leading-snug text-white/80">{detail}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 border-t border-white/10 pt-5">
                    <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.25em] text-white/30">
                      Working Execution Path
                    </div>
                    <div className="font-mono text-xs leading-relaxed text-amber-300/90 font-semibold">{active.route}</div>
                  </div>
                </div>
              </motion.article>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
