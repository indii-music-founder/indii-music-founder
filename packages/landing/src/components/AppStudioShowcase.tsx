'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Layers,
  Share2,
  Activity,
  DollarSign,
  CheckCircle2,
  Disc,
  FileCode,
  Zap,
} from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  badge: string;
  icon: React.ElementType;
}

const tabs: TabItem[] = [
  { id: 'boardroom', label: 'Conductor & Boardroom', badge: 'Command Engine', icon: Sparkles },
  { id: 'creative', label: 'Creative Studio', badge: 'Visual & Video', icon: Layers },
  { id: 'distribution', label: 'Delivery Preparation', badge: 'DDEX ERN 4.3', icon: Share2 },
  { id: 'audio', label: 'Audio Intelligence', badge: 'Sonic DNA', icon: Activity },
  { id: 'finance', label: 'Financial Command', badge: 'Project Records', icon: DollarSign },
];

export default function AppStudioShowcase() {
  const [activeTab, setActiveTab] = useState<string>('boardroom');

  return (
    <section id="studio-preview" data-system-section="studio" className="relative z-20 w-full border-t border-white/10 bg-[#040404] py-24 md:py-36">
      {/* Glow Effects */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(245,158,11,0.08),transparent_50%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 bg-amber-500/[0.04] blur-[140px]" />

      <div className="relative mx-auto max-w-[1500px] px-5 md:px-10">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
            <Zap size={13} />
            Inside the Workspace
          </div>
          <h2 className="mt-6 text-4xl font-black leading-tight tracking-[-0.045em] text-white sm:text-6xl md:text-7xl">
            See how your career <br />
            <span className="text-amber-400">actually gets run.</span>
          </h2>
          <p className="mt-6 text-base text-white/50 sm:text-lg md:text-xl">
            Explore an interactive, illustrative walkthrough of the connected workspace. Real product capture will replace these preview panels during the beta.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex items-center gap-2.5 rounded-full border px-5 py-3 text-xs font-bold transition-all duration-300 ${
                  isActive
                    ? 'border-amber-400/60 bg-amber-400 text-black shadow-[0_0_25px_rgba(245,158,11,0.35)] scale-[1.02]'
                    : 'border-white/10 bg-black/60 text-white/70 hover:border-white/25 hover:text-white'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-black' : 'text-amber-400'} />
                <span>{tab.label}</span>
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                    isActive ? 'bg-black/15 text-black' : 'bg-white/10 text-white/50'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Interactive Studio Frame */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-white/15 bg-black/90 shadow-[0_30px_100px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {/* Studio Title Bar */}
          <div className="flex h-12 items-center justify-between border-b border-white/10 bg-[#090909] px-5 font-mono text-[10px] text-white/40">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-4 tracking-[0.2em] uppercase text-white/60">indii.music / Founding Artist Beta</span>
            </div>
            <div className="hidden items-center gap-6 md:flex">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                System Active
              </span>
              <span>Connected Project Context</span>
              <span className="text-amber-400 font-bold">Artist Controlled</span>
            </div>
          </div>

          {/* Studio Content View */}
          <div className="min-h-[520px] p-6 md:p-10">
            <AnimatePresence mode="wait">
              {activeTab === 'boardroom' && (
                <motion.div
                  key="boardroom"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35 }}
                  className="grid gap-8 lg:grid-cols-[1fr_1.2fr]"
                >
                  <div className="flex flex-col justify-between">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
                        Conductor Command Engine
                      </div>
                      <h3 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
                        You speak the direction. <br />
                        The system carries the work.
                      </h3>
                      <p className="mt-4 text-sm leading-relaxed text-white/60">
                        Type or speak in plain English. Conductor turns the goal into visible work, brings in the relevant specialists, and keeps the shared project context connected.
                      </p>
                    </div>

                    <div className="mt-8 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-5">
                      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-amber-400">
                        <span>Live Voice Input Captured</span>
                        <span>0.4s latency</span>
                      </div>
                      <p className="mt-2 font-medium text-white">
                        “Prepare my summer single for Spotify & Apple Music, build 3 artwork variations matching my visual profile, and set up a 14-day waterfall rollout.”
                      </p>
                    </div>
                  </div>

                  {/* Right Workflow Mockup */}
                  <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-6 font-sans">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                        Workflow Execution Graph
                      </span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[9px] uppercase text-emerald-400">
                        4 Departments In Progress
                      </span>
                    </div>

                    <div className="mt-6 space-y-4">
                      {[
                        { dept: 'Audio Intelligence', task: 'Extracted Track DNA (124 BPM, F# Minor, Ethereal)', status: 'Complete', color: 'text-emerald-400' },
                        { dept: 'Creative Director', task: 'Generated 3 Artwork Briefs (Minimalist Sans-Serif)', status: 'Awaiting Artist Review', color: 'text-amber-400' },
                        { dept: 'Delivery Preparation', task: 'Compiled DDEX ERN 4.3 XML Payload', status: 'Validated', color: 'text-emerald-400' },
                        { dept: 'Marketing & PR', task: 'Drafted 500-char Editorial Pitch & Waterfall Rollout', status: 'In Progress', color: 'text-blue-400' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-start gap-4 rounded-lg border border-white/5 bg-white/[0.02] p-4">
                          <CheckCircle2 size={18} className={`${item.color} mt-0.5 shrink-0`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-white/50">{item.dept}</span>
                              <span className={`font-mono text-[9px] uppercase font-semibold ${item.color}`}>{item.status}</span>
                            </div>
                            <p className="mt-1 text-xs font-medium text-white">{item.task}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'creative' && (
                <motion.div
                  key="creative"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35 }}
                  className="grid gap-8 lg:grid-cols-[1fr_1fr]"
                >
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
                      Creative Studio & Brand Guard
                    </div>
                    <h3 className="mt-3 text-3xl font-black text-white md:text-4xl">
                      Generate 4K release visuals <br />
                      without diluting your brand.
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-white/60">
                      Upload reference assets or prompt in plain language. Creative Director automatically scores every generated visual (0-100) against your Brand Bible typography, color palette, and visual identity.
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
                        <div className="font-mono text-[9px] uppercase text-white/40">Brand Consistency</div>
                        <div className="mt-2 text-3xl font-black text-emerald-400">96 / 100</div>
                        <div className="mt-1 text-[10px] text-white/50">Strict Minimalist Rules Applied</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4">
                        <div className="font-mono text-[9px] uppercase text-white/40">Resolution Output</div>
                        <div className="mt-2 text-3xl font-black text-amber-400">4K Master</div>
                        <div className="mt-1 text-[10px] text-white/50">Spotify Canvas & Vinyl Ready</div>
                      </div>
                    </div>
                  </div>

                  {/* Studio Visual Canvas Mockup */}
                  <div className="relative flex min-h-[300px] flex-col justify-between rounded-xl border border-amber-400/20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/20 via-black to-black p-6">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                        Active Visual Generation
                      </span>
                      <span className="rounded-full bg-amber-400/20 px-3 py-1 font-mono text-[9px] text-amber-300">
                        1:1 Square (3000x3000px)
                      </span>
                    </div>

                    <div className="my-auto text-center">
                      <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl border border-amber-400/40 bg-black/80 shadow-[0_0_40px_rgba(245,158,11,0.25)]">
                        <Disc size={48} className="animate-spin text-amber-400 [animation-duration:12s]" />
                      </div>
                      <p className="mt-4 text-xs font-mono text-white/70">
                        Title: <span className="text-amber-400">NOSTALGIA_V4_FINAL.WAV</span>
                      </p>
                      <p className="text-[10px] font-mono text-white/40">Typography: Neue Haas Grotesk Light</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50">
                      <span>Palette: Amber / Obsidian / Slate</span>
                      <span className="text-emerald-400 font-mono">Ready for Export</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'distribution' && (
                <motion.div
                  key="distribution"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35 }}
                  className="grid gap-8 lg:grid-cols-[1fr_1.2fr]"
                >
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
                      Delivery Preparation
                    </div>
                    <h3 className="mt-3 text-3xl font-black text-white md:text-4xl">
                      Prepare the release. <br />
                      Keep the package connected.
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-white/60">
                      Bring mastered audio, artwork, credits, identifiers, and release metadata together. indii helps format and validate a delivery-ready package using DDEX ERN 4.3 standards.
                    </p>

                    <div className="mt-8 space-y-3 font-mono text-xs">
                      {[
                        'Artist-controlled release record',
                        'Identifier and metadata checks',
                        'DDEX ERN 4.3 package preparation',
                        'Delivery-ready files for the next approved step',
                      ].map((benefit, i) => (
                        <div key={i} className="flex items-center gap-3 text-white/80">
                          <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* DDEX Code Mockup */}
                  <div className="rounded-xl border border-white/10 bg-[#080808] p-6 font-mono">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2 text-xs text-white/60">
                        <FileCode size={14} className="text-amber-400" />
                        <span>DDEX_ERN_43_PAYLOAD.XML</span>
                      </div>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[9px] uppercase text-emerald-400">
                        Schema Validated
                      </span>
                    </div>

                    <pre className="mt-4 text-[11px] leading-relaxed text-amber-300/80 overflow-x-auto">
{`<NewReleaseMessage xmlns="http://ddex.net/xml/ern/43">
  <MessageHeader>
    <SenderPartyId>PADPIDA20260803</SenderPartyId>
    <MessageThreadId>INDII_CATALOG_8921</MessageThreadId>
  </MessageHeader>
  <ResourceList>
    <SoundRecording>
      <ISRC>US-NDI-26-00104</ISRC>
      <Title>Detroit Midnight</Title>
      <Duration>PT3M42S</Duration>
    </SoundRecording>
  </ResourceList>
  <DealList>
    <ReleaseStatus>DeliveryPackagePrepared</ReleaseStatus>
    <ArtistReview>RequiredBeforeExternalDelivery</ArtistReview>
  </DealList>
</NewReleaseMessage>`}
                    </pre>
                  </div>
                </motion.div>
              )}

              {activeTab === 'audio' && (
                <motion.div
                  key="audio"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35 }}
                  className="grid gap-8 lg:grid-cols-[1fr_1fr]"
                >
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
                      Audio Intelligence & DNA Extraction
                    </div>
                    <h3 className="mt-3 text-3xl font-black text-white md:text-4xl">
                      Understand your track <br />
                      down to the millisecond.
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-white/60">
                      Upload your master WAV file. Audio Intelligence analyzes key, BPM, harmonic frequency, loudness (LUFS), and mood classification to optimize your DSP pitching and marketing campaigns.
                    </p>

                    <div className="mt-6 grid grid-cols-3 gap-3 font-mono">
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                        <div className="text-[9px] uppercase text-white/40">Tempo</div>
                        <div className="mt-1 text-xl font-bold text-amber-400">124 BPM</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                        <div className="text-[9px] uppercase text-white/40">Key</div>
                        <div className="mt-1 text-xl font-bold text-amber-400">F# Minor</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                        <div className="text-[9px] uppercase text-white/40">Loudness</div>
                        <div className="mt-1 text-xl font-bold text-emerald-400">-9.2 LUFS</div>
                      </div>
                    </div>
                  </div>

                  {/* Audio Waveform Mockup */}
                  <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#090909] p-6 font-mono">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs">
                      <span className="text-white/60">Audio DNA Analysis</span>
                      <span className="text-amber-400 font-bold">24-bit / 48kHz WAV</span>
                    </div>

                    <div className="my-8 flex items-end justify-center gap-1.5 h-32">
                      {[40, 65, 80, 45, 90, 100, 75, 55, 85, 95, 60, 40, 70, 85, 95, 100, 65, 45, 75, 90, 50, 35, 70, 85].map((h, i) => (
                        <div
                          key={i}
                          className="w-2 rounded-full bg-gradient-to-t from-amber-500/30 via-amber-400 to-amber-300"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-white/40 border-t border-white/10 pt-3">
                      <span>Classifier: Ethereal Electronic / Melodic Techno</span>
                      <span>Mood: Driving & Introspective</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'finance' && (
                <motion.div
                  key="finance"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35 }}
                  className="grid gap-8 lg:grid-cols-[1fr_1fr]"
                >
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
                      Financial Command & Royalties
                    </div>
                    <h3 className="mt-3 text-3xl font-black text-white md:text-4xl">
                      Real-time revenue tracking. <br />
                      Zero hidden deductions.
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-white/60">
                      Track reported streaming, sync, and merchandise income alongside collaborator split records and project expenses in one connected view.
                    </p>

                    <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.04] p-5">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-emerald-400">
                        Illustrative Project Summary
                      </div>
                      <div className="mt-2 text-4xl font-black text-white">One record</div>
                      <p className="mt-1 text-xs text-white/50">
                        Income, expenses, and split information stay connected to the work that created them.
                      </p>
                    </div>
                  </div>

                  {/* Financial Dashboard Card */}
                  <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#090909] p-6 font-mono">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs">
                      <span className="text-white/60">Catalog Financial Summary</span>
                      <span className="text-emerald-400 font-bold">Illustrative Data</span>
                    </div>

                    <div className="my-6 space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Gross DSP Revenue</span>
                        <span className="font-bold text-white">$14,820.50</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Sync & Placement Income</span>
                        <span className="font-bold text-white">$3,500.00</span>
                      </div>
                      <div className="flex items-center justify-between text-sm border-t border-white/10 pt-3">
                        <span className="text-amber-400 font-bold">Artist Net Earnings</span>
                        <span className="font-black text-xl text-amber-400">$18,320.50</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-white/40 border-t border-white/10 pt-3 flex items-center justify-between">
                      <span>Collaborator Split Records (3 Co-Writers)</span>
                      <span className="text-emerald-400">Connected</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
