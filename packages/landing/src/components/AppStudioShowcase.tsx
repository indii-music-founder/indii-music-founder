'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Layers, Share2, Activity, DollarSign, CheckCircle2, Disc, FileCode, Zap } from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  badge: string;
  icon: React.ElementType;
  hex: string;
  glow: string;
}

const tabs: TabItem[] = [
  {
    id: 'boardroom',
    label: 'Conductor & Boardroom',
    badge: 'Command Engine',
    icon: Sparkles,
    hex: '#FFB800',
    glow: 'rgba(255, 184, 0, 0.35)',
  },
  {
    id: 'creative',
    label: 'Creative Studio',
    badge: 'Visual & Video',
    icon: Layers,
    hex: '#00FF66',
    glow: 'rgba(0, 255, 102, 0.35)',
  },
  {
    id: 'distribution',
    label: 'Delivery Preparation',
    badge: 'DDEX ERN 4.3',
    icon: Share2,
    hex: '#2196F3',
    glow: 'rgba(33, 150, 243, 0.35)',
  },
  {
    id: 'audio',
    label: 'Audio Intelligence',
    badge: 'Sonic DNA©',
    icon: Activity,
    hex: '#00BCD4',
    glow: 'rgba(0, 188, 212, 0.35)',
  },
  {
    id: 'finance',
    label: 'Financial Command',
    badge: 'Project Records',
    icon: DollarSign,
    hex: '#FFC107',
    glow: 'rgba(255, 193, 7, 0.35)',
  },
];

export default function AppStudioShowcase() {
  const [activeTab, setActiveTab] = useState<string>('boardroom');

  return (
    <section id="studio-preview" data-system-section="studio" className="relative z-20 w-full border-t border-white/10 bg-black py-24 md:py-36">
      {/* Dynamic Department Glow Effects */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          background: 'radial-gradient(circle at 50% 20%, rgba(255,184,0,0.06), transparent 55%)',
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 blur-[160px] transition-all duration-700 opacity-40"
        style={{
          backgroundColor: 'rgba(255,184,0,0.03)',
        }}
      />

      <div className="relative mx-auto max-w-[1500px] px-5 md:px-10">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-white/[0.03] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
            <Zap size={13} />
            Inside the Workspace
          </div>
          <h2 className="mt-6 text-4xl font-black leading-tight tracking-[-0.045em] text-white sm:text-6xl md:text-7xl">
            Start with finished music. <br />
            <span className="text-amber-400">Leave with a campaign.</span>
          </h2>
          <p className="mt-6 text-base text-white/50 sm:text-lg md:text-xl">
            Bring one finished song and one image—or create a visual inside indii.music. Follow one guided workflow and leave with a mini campaign pack of short
            clips and images.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-white/55">
            {['Verified email required', 'No watermark', 'Keep your exports', 'Choose to save or delete uploads'].map((fact) => (
              <span key={fact} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">{fact}</span>
            ))}
          </div>
          <a href="#waitlist" className="mt-7 inline-flex rounded-full bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] px-7 py-3.5 text-xs font-black text-black shadow-[0_0_25px_rgba(255,184,0,0.45)] transition-all hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(255,184,0,0.7)]">
            See how indii.music works
          </a>
          <p className="mt-5 text-xs text-white/45">
            The workspace below is an illustrative walkthrough. Real product capture will replace these preview panels during the beta.
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
                    ? 'bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] text-black shadow-[0_0_25px_rgba(255,184,0,0.4)] border-amber-400 scale-[1.03]'
                    : 'border-white/10 bg-black/70 text-white/70 hover:border-white/25 hover:text-white'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-black' : ''} style={!isActive ? { color: tab.hex } : {}} />
                <span>{tab.label}</span>
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                    isActive ? 'bg-black/20 text-black font-bold' : 'bg-white/10 text-white/50'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Interactive Studio Frame */}
        <div className="lacquer-card relative mt-12 overflow-hidden rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.95)] backdrop-blur-xl">
          <div
            className="absolute inset-x-0 top-0 h-[1px] specular-line-gold z-10"
          />
          {/* Studio Title Bar */}
          <div className="flex h-12 items-center justify-between border-b border-white/10 bg-[#090909] px-5 font-mono text-[10px] text-white/40">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-4 tracking-[0.2em] uppercase text-white/60">indii.music / illustrative beta walkthrough</span>
            </div>
            <div className="hidden items-center gap-6 md:flex">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                Illustrative Preview
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
                      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">Conductor Command Engine</div>
                      <h3 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
                        You speak the direction. <br />
                        The system carries the work.
                      </h3>
                      <p className="mt-4 text-sm leading-relaxed text-white/60">
                        Type or speak in plain English. Conductor turns the goal into visible work, brings in the relevant specialists, and keeps the shared
                        project context connected through Connected Intelligence©.
                      </p>
                    </div>

                    <div className="mt-8 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-5">
                      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-amber-400">
                        <span>Example artist direction</span>
                        <span>Connected Intelligence©</span>
                      </div>
                      <p className="mt-2 font-medium text-white">
                        “Prepare a delivery-ready package for my summer single, build three artwork directions from my visual profile, and plan a 14-day
                        rollout.”
                      </p>
                    </div>
                  </div>

                  {/* Right Workflow Mockup */}
                  <div className="rounded-xl border border-white/10 bg-[#0c0c0c] p-6 font-sans">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">Workflow Execution Graph</span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[9px] uppercase text-emerald-400">Relevant workstreams</span>
                    </div>

                    <div className="mt-6 space-y-4">
                      {[
                        {
                          dept: 'Brand Manager',
                          task: 'Synced Brand Guidelines (Emerald, Obsidian, Violet)',
                          status: 'Connected',
                          color: 'text-emerald-400',
                        },
                        {
                          dept: 'Creative Director',
                          task: 'Ingested Brand Kit — Generated 3 Artwork Briefs',
                          status: 'Awaiting Artist Review',
                          color: 'text-amber-400',
                        },
                        {
                          dept: 'Delivery Preparation',
                          task: 'Compiled DDEX ERN 4.3 XML Payload',
                          status: 'Validated',
                          color: 'text-emerald-400',
                        },
                        {
                          dept: 'Marketing & PR',
                          task: 'Drafted 500-char Editorial Pitch & Waterfall Rollout',
                          status: 'In Progress',
                          color: 'text-blue-400',
                        },
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
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#00FF66]">Creative Studio & Brand Guard©</div>
                    <h3 className="mt-3 text-3xl font-black text-white md:text-4xl">
                      Build release visuals <br />
                      from one shared direction.
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-white/60">
                      Upload reference assets or begin with a plain-language direction. Powered by Connected Intelligence©, the art department automatically works within the brand guidelines and color palettes established with your Brand Manager.
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4 transition-colors hover:border-[#00FF66]/30">
                        <div className="font-mono text-[9px] uppercase text-white/40">Connected Intelligence©</div>
                        <div className="mt-2 text-3xl font-black text-[#00FF66]">In sync</div>
                        <div className="mt-1 text-[10px] text-white/50">Brand guidelines enforced</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4 transition-colors hover:border-[#00FF66]/30">
                        <div className="font-mono text-[9px] uppercase text-white/40">Resolution Output</div>
                        <div className="mt-2 text-3xl font-black text-[#9C27B0]">Export set</div>
                        <div className="mt-1 text-[10px] text-white/50">Formats selected by the artist</div>
                      </div>
                    </div>
                  </div>

                  {/* Studio Visual Canvas Mockup */}
                  <div className="relative flex min-h-[300px] flex-col justify-between rounded-xl border border-[#00FF66]/30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-[#0a0f0d] to-black p-6 shadow-[0_0_50px_rgba(0,255,102,0.1)]">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-[#00FF66]">Active Visual Generation</span>
                      <span className="rounded-full border border-[#00FF66]/40 bg-[#00FF66]/20 px-3 py-1 font-mono text-[9px] text-[#00FF66]">1:1 Square (3000x3000px)</span>
                    </div>

                    <div className="my-auto text-center">
                      <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl border border-[#00FF66]/40 bg-black/80 shadow-[0_0_40px_rgba(0,255,102,0.25)]">
                        <Disc size={48} className="animate-spin text-[#00FF66] [animation-duration:12s]" />
                      </div>
                      <p className="mt-4 text-xs font-mono text-white/70">
                        Title: <span className="text-[#00FF66]">NOSTALGIA_V4_FINAL.WAV</span>
                      </p>
                      <p className="text-[10px] font-mono text-white/40">Typography: Neue Haas Grotesk Light</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/50">
                      <span>Palette: Emerald / Obsidian / Violet</span>
                      <span className="text-[#00FF66] font-mono font-bold">Ready for Export</span>
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
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#2196F3]">Delivery Preparation</div>
                    <h3 className="mt-3 text-3xl font-black text-white md:text-4xl">
                      Prepare the release. <br />
                      Keep the package connected.
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-white/60">
                      Bring mastered audio, artwork, credits, identifiers, and release metadata together. indii helps format and validate a delivery-ready
                      package using DDEX ERN 4.3 standards.
                    </p>

                    <div className="mt-8 space-y-3 font-mono text-xs">
                      {[
                        'Artist-controlled release record',
                        'Identifier and metadata checks',
                        'DDEX ERN 4.3 package preparation',
                        'Delivery-ready files for the next approved step',
                      ].map((benefit, i) => (
                        <div key={i} className="flex items-center gap-3 text-white/80">
                          <CheckCircle2 size={16} className="text-[#2196F3] shrink-0" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* DDEX Code Mockup */}
                  <div className="rounded-xl border border-[#2196F3]/30 bg-[#040810] p-6 font-mono shadow-[0_0_40px_rgba(33,150,243,0.1)]">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2 text-xs text-white/70">
                        <FileCode size={14} className="text-[#2196F3]" />
                        <span>DDEX_ERN_43_PAYLOAD.XML</span>
                      </div>
                      <span className="rounded bg-[#2196F3]/20 border border-[#2196F3]/40 px-2 py-0.5 text-[9px] uppercase text-[#2196F3] font-bold">Schema Validated</span>
                    </div>

                    <pre className="mt-4 text-[11px] leading-relaxed text-[#64B5F6] overflow-x-auto">
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
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#00BCD4]">Audio Intelligence & Sonic DNA© Extraction</div>
                    <h3 className="mt-3 text-3xl font-black text-white md:text-4xl">
                      Understand your track <br />
                      down to the millisecond.
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-white/60">
                      Upload your master WAV file. Audio Intelligence analyzes key, BPM, harmonic frequency, loudness (LUFS), and mood classification to
                      optimize your DSP pitching and marketing campaigns.
                    </p>

                    <div className="mt-6 grid grid-cols-3 gap-3 font-mono">
                      <div className="rounded-lg border border-[#00BCD4]/20 bg-[#00BCD4]/[0.05] p-3 text-center">
                        <div className="text-[9px] uppercase text-white/40">Tempo</div>
                        <div className="mt-1 text-xl font-bold text-[#00BCD4]">124 BPM</div>
                      </div>
                      <div className="rounded-lg border border-[#00BCD4]/20 bg-[#00BCD4]/[0.05] p-3 text-center">
                        <div className="text-[9px] uppercase text-white/40">Key</div>
                        <div className="mt-1 text-xl font-bold text-[#00BCD4]">F# Minor</div>
                      </div>
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-center">
                        <div className="text-[9px] uppercase text-white/40">Loudness</div>
                        <div className="mt-1 text-xl font-bold text-emerald-400">-9.2 LUFS</div>
                      </div>
                    </div>
                  </div>

                  {/* Audio Waveform Mockup */}
                  <div className="flex flex-col justify-between rounded-xl border border-[#00BCD4]/30 bg-[#03090e] p-6 font-mono shadow-[0_0_40px_rgba(0,188,212,0.1)]">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 text-xs">
                      <span className="text-white/60">Sonic DNA© Analysis</span>
                      <span className="text-[#00BCD4] font-bold">24-bit / 48kHz WAV</span>
                    </div>

                    <div className="my-8 flex items-end justify-center gap-1.5 h-32">
                      {[40, 65, 80, 45, 90, 100, 75, 55, 85, 95, 60, 40, 70, 85, 95, 100, 65, 45, 75, 90, 50, 35, 70, 85].map((h, i) => (
                        <div key={i} className="w-2 rounded-full bg-gradient-to-t from-[#00BCD4]/30 via-[#00BCD4] to-[#00F0FF]" style={{ height: `${h}%` }} />
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
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#FFC107]">Financial Command & Royalties</div>
                    <h3 className="mt-3 text-3xl font-black text-white md:text-4xl">
                      Real-time revenue tracking. <br />
                      Zero hidden deductions.
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-white/60">
                      Track reported streaming, sync, and merchandise income alongside collaborator split records and project expenses in one connected view.
                    </p>

                    <div className="mt-6 rounded-xl border border-[#FFC107]/30 bg-[#FFC107]/[0.05] p-5">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-[#FFC107]">Illustrative Project Summary</div>
                      <div className="mt-2 text-4xl font-black text-white">One record</div>
                      <p className="mt-1 text-xs text-white/50">Income, expenses, and split information stay connected to the work that created them.</p>
                    </div>
                  </div>

                  {/* Financial Dashboard Card */}
                  <div className="flex flex-col justify-between rounded-xl border border-[#FFC107]/25 bg-[#0a0904] p-6 font-mono shadow-[0_0_40px_rgba(255,193,7,0.1)]">
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
                        <span className="text-[#FFC107] font-bold">Artist Net Earnings</span>
                        <span className="font-black text-xl text-[#FFC107]">$18,320.50</span>
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
