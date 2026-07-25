'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

interface Workstream {
  id: string;
  index: string;
  name: string;
  title: string;
  outcome: string;
  details: string[];
  route: string;
}

const workstreams: Workstream[] = [
  {
    id: 'distribution',
    index: '01',
    name: 'Distribution',
    title: 'Prepare a release without losing the thread.',
    outcome:
      'Keep release information, delivery requirements, ownership details, and platform preparation together before anything leaves your hands.',
    details: ['Release metadata', 'Delivery preparation', 'Ownership records'],
    route: 'Track → release record → review → delivery',
  },
  {
    id: 'music',
    index: '02',
    name: 'Audio',
    title: 'Know what is inside the record.',
    outcome:
      'Analyze tempo, key, energy, and other useful audio characteristics so the rest of the project can work from the same source.',
    details: ['Tempo and key', 'Audio characteristics', 'Project-ready context'],
    route: 'Audio → analysis → shared project context',
  },
  {
    id: 'creative',
    index: '03',
    name: 'Creative',
    title: 'Build the visual world around the sound.',
    outcome:
      'Develop artwork, video concepts, and creative assets inside the project instead of scattering the work across disconnected tools.',
    details: ['Artwork direction', 'Video production', 'Reviewable assets'],
    route: 'Sound profile → direction → asset → approval',
  },
  {
    id: 'brand',
    index: '04',
    name: 'Brand',
    title: 'Keep every public move recognizably yours.',
    outcome:
      'Hold the language, visual direction, references, and working decisions that keep a release consistent across every surface.',
    details: ['Identity system', 'Campaign consistency', 'Creative references'],
    route: 'Artist identity → guardrails → consistent output',
  },
  {
    id: 'rights',
    index: '05',
    name: 'Rights',
    title: 'Make ownership visible before it becomes a problem.',
    outcome:
      'Organize splits, contributors, registrations, agreements, and rights information around the work they belong to.',
    details: ['Split records', 'Contributor details', 'Rights preparation'],
    route: 'Work → contributors → ownership record → review',
  },
  {
    id: 'finance',
    index: '06',
    name: 'Finance',
    title: 'See the business attached to the music.',
    outcome:
      'Bring expenses, revenue information, royalty records, and business decisions into the same operating view as the project.',
    details: ['Revenue records', 'Expense context', 'Royalty preparation'],
    route: 'Activity → record → review → clearer decisions',
  },
  {
    id: 'marketing',
    index: '07',
    name: 'Marketing',
    title: 'Turn a release date into a working campaign.',
    outcome:
      'Shape the message, audience, assets, and schedule around a release while keeping every step connected to the actual project.',
    details: ['Campaign planning', 'Audience direction', 'Asset coordination'],
    route: 'Goal → campaign plan → work → review',
  },
  {
    id: 'social',
    index: '08',
    name: 'Social',
    title: 'Prepare the work. Keep the final say.',
    outcome:
      'Develop platform-ready ideas and content for review without turning your voice over to an automatic posting machine.',
    details: ['Content planning', 'Platform formats', 'Approval before action'],
    route: 'Campaign → content → artist review → approved action',
  },
  {
    id: 'publishing',
    index: '09',
    name: 'Publishing',
    title: 'Treat the catalog like the asset it is.',
    outcome:
      'Keep songs, writers, ownership details, and publishing work organized as the catalog grows.',
    details: ['Song records', 'Writer information', 'Catalog organization'],
    route: 'Song → writer data → catalog record',
  },
  {
    id: 'licensing',
    index: '10',
    name: 'Licensing',
    title: 'Be ready when the right opportunity appears.',
    outcome:
      'Prepare pitch materials, rights context, and track information for licensing work without pretending a placement is guaranteed.',
    details: ['Pitch preparation', 'Rights context', 'Opportunity tracking'],
    route: 'Opportunity → qualified catalog → prepared pitch',
  },
  {
    id: 'publicist',
    index: '11',
    name: 'Publicity',
    title: 'Give the story a professional shape.',
    outcome:
      'Build press materials and outreach plans from the same release facts, approved language, and assets used everywhere else.',
    details: ['Press materials', 'EPK preparation', 'Outreach planning'],
    route: 'Release story → materials → review → outreach',
  },
  {
    id: 'road',
    index: '12',
    name: 'Road',
    title: 'Keep the show connected to the business.',
    outcome:
      'Plan dates, routes, contacts, travel details, and show information without separating touring from the rest of the artist operation.',
    details: ['Route planning', 'Show records', 'Travel and contact details'],
    route: 'Date → route → logistics → working itinerary',
  },
  {
    id: 'merchandise',
    index: '13',
    name: 'Merchandise',
    title: 'Carry the identity into something physical.',
    outcome:
      'Develop merchandise concepts and product records alongside the visual system and campaign they came from.',
    details: ['Product concepts', 'Creative continuity', 'Catalog records'],
    route: 'Identity → product direction → reviewable catalog',
  },
  {
    id: 'security',
    index: '14',
    name: 'Control',
    title: 'High-impact actions stay visible.',
    outcome:
      'Keep approvals, project assets, records, and action boundaries in view so speed does not come at the cost of control.',
    details: ['Approval surfaces', 'Project records', 'Action boundaries'],
    route: 'Plan → proposed action → review → approval',
  },
  {
    id: 'conductor',
    index: '15',
    name: 'Conductor',
    title: 'One request can move the whole project.',
    outcome:
      'Turn an artist goal into coordinated work across the relevant departments, with the plan and its progress visible in one place.',
    details: ['Cross-department plans', 'Shared project context', 'Visible progress'],
    route: 'Intent → plan → specialists → artist review',
  },
];

export default function AgentGrid() {
  const [activeId, setActiveId] = useState(workstreams[0].id);
  const active = workstreams.find((workstream) => workstream.id === activeId) ?? workstreams[0];

  return (
    <section id="capabilities" className="relative z-20 w-full border-t border-white/10">
      <div className="mx-auto max-w-[1500px] px-5 py-28 md:px-10 md:py-40">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-10 border-b border-white/10 pb-16 lg:grid-cols-[0.65fr_1.35fr]"
        >
          <div>
            <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-amber-400">
              The working system
            </div>
            <div className="font-mono text-xs uppercase leading-relaxed tracking-[0.18em] text-white/35">
              15 connected areas
              <br />
              One artist-controlled workspace
            </div>
          </div>
          <div>
            <h2 className="max-w-5xl text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-6xl md:text-8xl lg:text-[7.8rem]">
              The work around the music,
              <span className="block text-amber-400">finally in formation.</span>
            </h2>
            <p className="mt-10 max-w-2xl text-lg leading-relaxed text-white/55 md:text-xl">
              indii brings the parts of an independent career into one operating view. Choose an area to see what it is actually built to hold.
            </p>
          </div>
        </motion.div>

        <div className="-mx-5 mt-10 flex gap-0 overflow-x-auto border-y border-white/10 px-5 no-scrollbar lg:hidden">
          {workstreams.map((workstream) => {
            const isActive = workstream.id === active.id;
            return (
              <button
                key={workstream.id}
                type="button"
                onClick={() => setActiveId(workstream.id)}
                className={`flex shrink-0 items-center gap-2 border-r border-white/10 px-4 py-4 font-mono text-[9px] uppercase tracking-[0.16em] transition-colors ${
                  isActive ? 'bg-amber-400 text-black' : 'text-white/35'
                }`}
                aria-pressed={isActive}
              >
                <span>{workstream.index}</span>
                <span>{workstream.name}</span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-12 pt-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:pt-12">
          <div className="hidden border-t border-white/10 lg:block">
            {workstreams.map((workstream) => {
              const isActive = workstream.id === active.id;
              return (
                <button
                  key={workstream.id}
                  type="button"
                  onClick={() => setActiveId(workstream.id)}
                  className={`group flex w-full items-center gap-5 border-b px-0 py-4 text-left transition-colors md:py-5 ${
                    isActive
                      ? 'border-amber-400/45 text-white'
                      : 'border-white/8 text-white/35 hover:border-white/20 hover:text-white/75'
                  }`}
                  aria-pressed={isActive}
                >
                  <span className={`font-mono text-[10px] tracking-[0.2em] ${isActive ? 'text-amber-400' : 'text-white/20'}`}>
                    {workstream.index}
                  </span>
                  <span className="flex-1 text-lg font-semibold tracking-tight md:text-xl">{workstream.name}</span>
                  <ArrowUpRight
                    size={16}
                    className={`transition-transform ${isActive ? 'translate-x-0 text-amber-400' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`}
                  />
                </button>
              );
            })}
          </div>

          <div className="lg:sticky lg:top-28 lg:h-fit">
            <AnimatePresence mode="wait">
              <motion.article
                key={active.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                className="relative min-h-[500px] overflow-hidden border border-white/10 bg-[#070707] p-7 md:min-h-[560px] md:p-12 lg:p-16"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(245,158,11,0.13),transparent_34%),linear-gradient(135deg,transparent,rgba(255,255,255,0.02))]" />
                <div className="absolute -right-8 -top-20 select-none font-mono text-[15rem] font-black leading-none text-white/[0.025] md:text-[22rem]">
                  {active.index}
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between border-b border-white/10 pb-5 font-mono text-[10px] uppercase tracking-[0.24em]">
                    <span className="text-amber-400">{active.name}</span>
                    <span className="text-white/25">Product surface / {active.index}</span>
                  </div>

                  <h3 className="mt-12 max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.045em] text-white md:text-6xl">
                    {active.title}
                  </h3>
                  <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/55 md:text-xl">
                    {active.outcome}
                  </p>

                  <div className="mt-12 grid gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
                    {active.details.map((detail) => (
                      <div key={detail} className="bg-[#080808] px-5 py-6">
                        <div className="mb-4 h-1 w-1 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                        <div className="text-sm font-medium leading-snug text-white/70">{detail}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-12 border-t border-white/10 pt-5">
                    <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.25em] text-white/25">
                      Working path
                    </div>
                    <div className="font-mono text-xs leading-relaxed text-amber-300/75">{active.route}</div>
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
