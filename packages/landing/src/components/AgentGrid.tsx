'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Sparkles,
  AudioWaveform,
  Scale,
  DollarSign,
  Megaphone,
  BookOpen,
  BarChart3,
  Palette,
  Key,
  ShoppingBag,
  Newspaper,
  MapPin,
  Share2,
  Video,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Drippy Panel Component (High-Intensity Glassmorphism)             */
/* ------------------------------------------------------------------ */

function NoiseOverlay() {
  return (
    <div className="absolute inset-0 opacity-[0.04] pointer-events-none z-0 mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
  );
}

function SpotlightCard({
  children,
  className = '',
  glowColor = 'rgba(46,46,254,0.15)',
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-[2.5rem] glass-panel transition-all duration-700 hover:-translate-y-2 group/card drippy-border shadow-2xl ${className}`}
    >
      {/* Primary Liquid Spotlight Glow */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-700 z-0"
        style={{
          opacity,
          background: `radial-gradient(800px circle at ${position.x}px ${position.y}px, ${glowColor}, transparent 40%)`,
        }}
      />
      
      {/* Secondary Dynamic Accents */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-1000 z-0 blur-[80px]"
        style={{
          opacity: opacity * 0.4,
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, ${glowColor.replace('0.25', '0.5').replace('0.15', '0.3')}, transparent 60%)`,
        }}
      />

      {/* Noise Texture Overlay */}
      <NoiseOverlay />

      {/* Internal Glass Sheen */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent pointer-events-none z-1" />

      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Agent Data — Hardened for Music Industry Standards                */
/* ------------------------------------------------------------------ */

interface AgentDef {
  id: string;
  name: string;
  title: string;
  tagline: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
  colorClass: string;        
  bgClass: string;           
  borderClass: string;       
  glowColor: string;         
  tier: 1 | 2 | 3;
  image?: string;            
}

const agents: AgentDef[] = [
  /* ---- TIER 1: CORE ENGINE ---- */
  {
    id: 'distribution',
    name: 'Access',
    title: 'Global Freedom',
    tagline: 'Kill the Middlemen.',
    description:
      'Upload once, dominate everywhere. No labels, no commissions, no gatekeepers. 100% of your royalties and total ownership of your masters.',
    keywords: ['Zero Commissions', 'Master Ownership', 'Global Reach', 'No Middlemen', 'Instant Deployment'],
    icon: Globe,
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/20',
    glowColor: 'rgba(46,46,254,0.25)',
    tier: 1,
    image: '/distro-real.png',
  },
  {
    id: 'creative',
    name: 'Creative',
    title: 'Visual Alchemist',
    tagline: 'Look like the Sound.',
    description:
      'Generate cinematic 4K album art and music videos that match your sonic DNA. High-end visual identity deployed at the speed of thought.',
    keywords: ['4K Cinematic Art', 'Video Alchemy', 'Visual DNA', 'Style Transfer', 'Instant Creative'],
    icon: Sparkles,
    colorClass: 'text-pink-400',
    bgClass: 'bg-pink-500/10',
    borderClass: 'border-pink-500/20',
    glowColor: 'rgba(254,46,154,0.25)',
    tier: 1,
    image: '/creative-real.png',
  },
  {
    id: 'music',
    name: 'Music',
    title: 'Sonic Auditor',
    tagline: 'Know your DNA.',
    description:
      'Deep audio forensics for BPM, key, mood, and energy. Ensure your mixes are industry-hardened and platform-ready before you hit upload.',
    keywords: ['BPM & Key', 'Mood Matrix', 'Forensic Audit', 'Sonic Identity', 'Mix Hardening'],
    icon: AudioWaveform,
    colorClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/20',
    glowColor: 'rgba(0,240,255,0.25)',
    tier: 1,
    image: '/audio-real.png',
  },

  /* ---- TIER 2: BUSINESS OPS ---- */
  {
    id: 'governance',
    name: 'Command',
    title: 'Career Command',
    tagline: 'CEO Status.',
    description:
      'The bridge between intent and execution. Every action is tracked, secured, and owned by you. Total career independence without the bloodsucking managers.',
    keywords: ['Direct Command', 'Secure Ops', 'Zero Management', 'Total Independence', 'Identity Guard'],
    icon: ShieldCheck,
    colorClass: 'text-violet-400',
    bgClass: 'bg-violet-500/10',
    borderClass: 'border-violet-500/20',
    glowColor: 'rgba(139,92,246,0.2)',
    tier: 2,
    image: '/conductor-real.png',
  },
  {
    id: 'finance',
    name: 'Finance',
    title: 'Independent Revenue',
    tagline: 'Real-Time Splits.',
    description:
      'Track every stream and every dollar in real-time. Automated payouts and a transparent ledger so you and your team get paid instantly.',
    keywords: ['Automated Splits', 'Live Revenue', 'Direct Payouts', 'No Hidden Fees', 'Transparent Ledger'],
    icon: DollarSign,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    glowColor: 'rgba(52,211,153,0.2)',
    tier: 2,
    image: '/dashboard-real.png',
  },
  {
    id: 'legal',
    name: 'Legal',
    title: 'Rights Guard',
    tagline: 'Secure the Bag.',
    description:
      'Instant forensic contract review and cryptographic copyright protection. Secure your splits and your legacy without the billable hours.',
    keywords: ['Contract AI', 'Rights Registry', 'Split Protection', 'Zero Legal Fees', 'Legacy Guard'],
    icon: Scale,
    colorClass: 'text-indigo-400',
    bgClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/20',
    glowColor: 'rgba(99,102,241,0.2)',
    tier: 2,
    image: '/legal-preview.png',
  },
  {
    id: 'marketing',
    name: 'Marketing',
    title: 'Fan Hunter',
    tagline: 'Find your 1,000 True Fans.',
    description:
      'No more guessing where your fans are. We use high-end data to find the people who actually want to connect with your sound—and help you turn them into your tribe.',
    keywords: ['Fan Growth', 'Audience Find', 'Targeting', 'Social Boost', 'Hype Engine'],
    icon: Megaphone,
    colorClass: 'text-rose-400',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/20',
    glowColor: 'rgba(244,63,94,0.2)',
    tier: 2,
    image: '/analytics-preview.png',
  },

  /* ---- TIER 3: FULL ARSENAL ---- */
  {
    id: 'publishing',
    name: 'Publishing',
    title: 'Independent Rights',
    tagline: 'Collect Every Cent.',
    description: 'Bypass the paperwork. Automatically register your works with global rights organizations and track every writer split. If your music is playing, you are getting paid.',
    keywords: ['Global Registration', 'Writer Splits', 'Royalty Recovery', 'Ownership Control'],
    icon: BookOpen,
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/20',
    glowColor: 'rgba(251,146,60,0.15)',
    tier: 3,
    image: '/dashboard-real.png',
  },
  {
    id: 'analytics',
    name: 'Analytics',
    title: 'Tribe Intelligence',
    tagline: 'Map the Momentum.',
    description: 'See the pulse of your tribe in real-time. Know exactly where your sound is winning and which cities are ready for your next move.',
    keywords: ['Pulse Tracking', 'Fan Mapping', 'Momentum Data', 'Growth Feed'],
    icon: BarChart3,
    colorClass: 'text-sky-400',
    bgClass: 'bg-sky-500/10',
    borderClass: 'border-sky-500/20',
    glowColor: 'rgba(56,189,248,0.15)',
    tier: 3,
    image: '/analytics-preview.png',
  },
  {
    id: 'video',
    name: 'Video',
    title: 'Visual Director',
    tagline: 'Cinematic Alchemy.',
    description: 'High-fidelity lyric videos and short-form social clips generated directly from your sonic DNA. Professional visuals, no crew required.',
    keywords: ['4K Lyric Videos', 'Social Clips', 'Pro Fidelity', 'Visual Chemistry'],
    icon: Video,
    colorClass: 'text-violet-400',
    bgClass: 'bg-violet-500/10',
    borderClass: 'border-violet-500/20',
    glowColor: 'rgba(139,92,246,0.15)',
    tier: 3,
    image: '/creative-studio.png',
  },
  {
    id: 'social',
    name: 'Social',
    title: 'Tribe Architect',
    tagline: 'Connected, Not Consumed.',
    description: 'Sync your social presence and keep your tribe engaged without the noise. Real connection, automated and authenticated by you.',
    keywords: ['Unified Presence', 'Tribe Sync', 'Authentic Reach', 'Engagement Hub'],
    icon: Share2,
    colorClass: 'text-indigo-400',
    bgClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/20',
    glowColor: 'rgba(99,102,241,0.15)',
    tier: 3,
    image: '/publicist-preview.png',
  },
  {
    id: 'licensing',
    name: 'Licensing',
    title: 'Sync Commander',
    tagline: 'Own the Screen.',
    description: 'Command high-paying placements in film, TV, and gaming. Automated pitching and clearing to turn your catalog into a revenue machine.',
    keywords: ['Sync Placements', 'Film & TV', 'Direct Pitching', 'Deal Flow'],
    icon: Key,
    colorClass: 'text-yellow-400',
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/20',
    glowColor: 'rgba(250,204,21,0.15)',
    tier: 3,
    image: '/legal-preview.png',
  },
  {
    id: 'merchandise',
    name: 'Merchandise',
    title: 'Physical Identity',
    tagline: 'Wear the Sound.',
    description: 'Design and deploy premium apparel for your tribe without inventory risks. High-end pieces, global shipping, zero overhead.',
    keywords: ['Tribe Gear', 'Physical Assets', 'Zero Inventory', 'Global Shipping'],
    icon: ShoppingBag,
    colorClass: 'text-lime-400',
    bgClass: 'bg-lime-500/10',
    borderClass: 'border-lime-500/20',
    glowColor: 'rgba(163,230,53,0.15)',
    tier: 3,
    image: '/creative-preview.png',
  },
  {
    id: 'publicist',
    name: 'Publicist',
    title: 'Media Machine',
    tagline: 'Control the Narrative.',
    description: 'Your autonomous press department. Deploy professional EPKs and outreach campaigns to the blogs and platforms that matter most.',
    keywords: ['Smart EPK', 'Narrative Control', 'Media Outreach', 'Press Flow'],
    icon: Newspaper,
    colorClass: 'text-teal-400',
    bgClass: 'bg-teal-500/10',
    borderClass: 'border-teal-500/20',
    glowColor: 'rgba(45,212,191,0.15)',
    tier: 3,
    image: '/publicist-preview.png',
  },
  {
    id: 'road',
    name: 'Road',
    title: 'Road Commander',
    tagline: 'Dominate the Stage.',
    description: 'Venues, routes, and logistics handled autonomously. Focus on the performance while your road crew secures the tour.',
    keywords: ['Venue Command', 'Route Mapping', 'Logistics AI', 'Live Execution'],
    icon: MapPin,
    colorClass: 'text-red-400',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/20',
    glowColor: 'rgba(248,113,113,0.15)',
    tier: 3,
    image: '/road-preview.png',
  },
];

function ScanlineOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-20 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
  );
}


/* ------------------------------------------------------------------ */
/*  Card Components                                                    */
/* ------------------------------------------------------------------ */

function HeroAgentCard({ agent, index }: { agent: AgentDef; index: number }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 40 },
        show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
      }}
    >
      <SpotlightCard className="h-full group/hero" glowColor={agent.glowColor}>
        <div className="p-8 md:p-12 flex flex-col h-full min-h-[520px]">
          {/* Agent Badge */}
          <div className="flex items-center justify-between mb-8">
            <div className={`w-16 h-16 rounded-2xl ${agent.bgClass} ${agent.borderClass} border flex items-center justify-center shadow-lg group-hover/hero:scale-110 transition-transform duration-700`}>
              <agent.icon className={agent.colorClass} size={32} />
            </div>
            <span className="text-[11px] font-mono font-bold tracking-[0.25em] uppercase text-gray-500 bg-white/[0.03] border border-white/5 px-4 py-2 rounded-full">
              {agent.name}
            </span>
          </div>

          {/* Copy */}
          <h3 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter leading-tight">
            {agent.title}
          </h3>
          <p className={`text-sm font-bold ${agent.colorClass} mb-6 tracking-[0.3em] uppercase glow-text`}>
            {agent.tagline}
          </p>
          <p className="text-gray-400 text-lg leading-relaxed font-light mb-10 max-w-lg">
            {agent.description}
          </p>

          {/* Keywords */}
          <div className="flex flex-wrap gap-2 mt-auto pb-6">
            {agent.keywords.map((kw) => (
              <span
                key={kw}
                className="text-[10px] font-mono font-bold tracking-widest uppercase text-gray-600 bg-white/[0.02] border border-white/5 px-3 py-1.5 rounded-xl hover:text-white hover:border-white/20 transition-all duration-300"
              >
                {kw}
              </span>
            ))}
          </div>

          {/* High-Fidelity App Screenshot */}
          {agent.image && (
            <div className="mt-8 -mx-8 md:-mx-12 -mb-8 md:-mb-12 relative overflow-hidden rounded-b-[2.5rem] border-t border-white/5 bg-black/40">
              <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-transparent z-10 pointer-events-none h-40" />
              <img
                src={agent.image}
                alt={`${agent.name} interface`}
                className="w-full h-64 md:h-80 object-cover object-top opacity-60 group-hover/hero:opacity-100 group-hover/hero:scale-105 transition-all duration-1000 ease-out mix-blend-screen"
                style={{ filter: `contrast(1.15) brightness(1.1) saturate(1.3) drop-shadow(0 0 40px ${agent.glowColor})` }}
                loading="lazy"
              />
              <ScanlineOverlay />
              <div className="absolute inset-0 shadow-[inset_0_-80px_100px_rgba(0,0,0,1)] pointer-events-none z-10" />
            </div>
          )}
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

function CoreAgentCard({ agent, index }: { agent: AgentDef; index: number }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
      }}
      className="group relative h-full"
    >
      <SpotlightCard className="h-full relative overflow-hidden" glowColor={agent.glowColor}>
        <div className="p-8 md:p-10 flex flex-col h-full min-h-[400px] relative z-10">
          <div
            className={`w-14 h-14 rounded-2xl ${agent.bgClass} ${agent.borderClass} border flex items-center justify-center group-hover:scale-110 transition-all duration-700 mb-8 relative`}
          >
             <div className={`absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-700 ${agent.bgClass}`} />
             <agent.icon className={`${agent.colorClass} relative z-10`} size={28} />
          </div>

          <h3 className="text-3xl font-black text-white mb-2 tracking-tight group-hover:text-chrome transition-all duration-500">
            {agent.title}
          </h3>
          <p className={`text-[10px] font-bold ${agent.colorClass} tracking-[0.3em] uppercase mb-6`}>
            {agent.tagline}
          </p>

          <p className="text-gray-400 text-base leading-relaxed mb-8 flex-1 font-light group-hover:text-gray-200 transition-colors duration-500">
            {agent.description}
          </p>

          <div className="flex flex-wrap gap-2">
            {agent.keywords.map((keyword) => (
              <span
                key={keyword}
                className="text-[9px] font-mono font-bold text-gray-500 bg-white/[0.03] px-2.5 py-1.5 rounded-lg border border-white/5 group-hover:border-white/10 group-hover:text-white transition-all duration-500"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>

        {/* Hover Image Preview */}
        {agent.image && (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-1000 pointer-events-none">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px] z-10" />
            <img 
              src={agent.image} 
              alt="" 
              className="w-full h-full object-cover scale-150 group-hover:scale-105 transition-transform duration-[2000ms] ease-out opacity-20 group-hover:opacity-70 mix-blend-screen"
              style={{ filter: `contrast(1.25) saturate(1.2) drop-shadow(0 0 30px ${agent.glowColor})` }}
            />
            <ScanlineOverlay />
          </div>
        )}
      </SpotlightCard>
    </motion.div>
  );
}

function ArsenalAgentCard({ agent, index }: { agent: AgentDef; index: number }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, scale: 0.95 },
        show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
      }}
      className="group/arsenal relative h-full"
    >
      <SpotlightCard className="h-full overflow-hidden border-white/[0.03] hover:border-white/[0.1] bg-white/[0.01]" glowColor={agent.glowColor}>
        <div className="p-6 md:p-8 flex flex-col h-full min-h-[240px] relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div
              className={`w-12 h-12 rounded-xl ${agent.bgClass} ${agent.borderClass} border flex items-center justify-center group-hover/arsenal:scale-110 transition-all duration-700 relative`}
            >
              <agent.icon className={`${agent.colorClass} relative z-10`} size={24} />
            </div>
            <div>
              <h4 className="text-xl font-bold text-white tracking-tight leading-none mb-1.5">{agent.title}</h4>
              <p className={`text-[10px] font-bold ${agent.colorClass} tracking-[0.2em] uppercase`}>
                {agent.tagline}
              </p>
            </div>
          </div>

          <p className="text-gray-500 text-sm leading-relaxed font-light flex-1 group-hover/arsenal:text-gray-300 transition-colors duration-500">
            {agent.description}
          </p>
        </div>

        {/* Dynamic Background Preview */}
        {agent.image && (
          <div className="absolute inset-0 opacity-0 group-hover/arsenal:opacity-100 transition-all duration-700 pointer-events-none">
            <div className="absolute inset-0 bg-black/80 z-10" />
            <img 
              src={agent.image} 
              alt="" 
              className="w-full h-full object-cover opacity-30 transition-all duration-1000 scale-110 group-hover/arsenal:scale-100 mix-blend-overlay group-hover/arsenal:mix-blend-normal"
              style={{ filter: `contrast(1.3) saturate(1.5) drop-shadow(0 0 20px ${agent.glowColor})` }}
            />
            <ScanlineOverlay />
          </div>
        )}
      </SpotlightCard>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Capability Ticker — horizontal scrolling keyword strip             */
/* ------------------------------------------------------------------ */

function CapabilityTicker() {
  const allKeywords = agents.flatMap((a) => a.keywords);
  const doubled = [...allKeywords, ...allKeywords];

  return (
    <div className="relative w-full overflow-hidden py-12 border-y border-white/[0.03] mb-24 bg-white/[0.01]">
      <div className="absolute left-0 top-0 bottom-0 w-64 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

      <motion.div
        className="flex gap-16 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
      >
        {doubled.map((kw, i) => (
          <span
            key={`${kw}-${i}`}
            className="text-xs font-mono font-bold tracking-[0.4em] uppercase text-gray-700 flex-shrink-0 flex items-center gap-16"
          >
            {kw}
            <div className="w-2 h-2 rounded-full bg-white/5 shadow-inner" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Export                                                        */
/* ------------------------------------------------------------------ */

export default function AgentGrid() {
  const heroAgents = agents.filter((a) => a.tier === 1);
  const coreAgents = agents.filter((a) => a.tier === 2);
  const arsenalAgents = agents.filter((a) => a.tier === 3);

  return (
    <section id="capabilities" className="w-full max-w-7xl px-4 py-40 z-20 relative mx-auto">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-24"
      >
        <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/[0.02] border border-white/5 text-[11px] font-black tracking-[0.4em] uppercase text-gray-500 mb-12 shadow-xl backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse" />
          The Architecture of Togetherness
        </div>
        <h2 className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter text-white mb-12 pb-4 leading-[0.85]">
          The Swarm <br className="hidden md:block" />
          <span className="text-chrome glow-text inline-block transform -rotate-1 skew-x-1">
            Replaces the Middlemen.
          </span>
        </h2>
        <p className="text-gray-500 max-w-4xl mx-auto text-base sm:text-lg md:text-xl lg:text-2xl leading-relaxed font-light px-4">
          Zero labels. Zero gatekeepers. Professional-grade tools 
          working for you as your personal crew. Take back control 
          of your career with global distribution and smart audio 
          analysis. indiiOS is your <strong>independent creative engine</strong>.
        </p>
      </motion.div>

      {/* Capability Ticker */}
      <CapabilityTicker />

      {/* ------ TIER 1: CORE ENGINE (3 large cards) ------ */}
      <motion.div 
        variants={{
          show: { transition: { staggerChildren: 0.15 } }
        }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-100px' }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12"
      >
        {heroAgents.map((agent, i) => (
          <HeroAgentCard key={agent.id} agent={agent} index={i} />
        ))}
      </motion.div>

      {/* ------ TIER 2: BUSINESS OPS (4 medium cards) ------ */}
      <motion.div 
        variants={{
          show: { transition: { staggerChildren: 0.1 } }
        }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12"
      >
        {coreAgents.map((agent, i) => (
          <CoreAgentCard key={agent.id} agent={agent} index={i} />
        ))}
      </motion.div>

      {/* ------ TIER 3: FULL ARSENAL (8 compact cards) ------ */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mb-12 mt-32"
      >
        <div className="flex items-center gap-10 mb-16">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <span className="text-[12px] font-mono font-black tracking-[0.5em] uppercase text-gray-800">
            Total Operational Supremacy
          </span>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </motion.div>

      <motion.div 
        variants={{
          show: { transition: { staggerChildren: 0.05 } }
        }}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '0px' }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
      >
        {arsenalAgents.map((agent, i) => (
          <ArsenalAgentCard key={agent.id} agent={agent} index={i} />
        ))}
      </motion.div>

      {/* Bottom CTA Gradient Spills */}
      <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[160px] pointer-events-none rounded-full" />
      <div className="absolute -bottom-40 left-1/4 -translate-x-1/2 w-[600px] h-[300px] bg-pink-600/5 blur-[140px] pointer-events-none rounded-full" />
    </section>
  );
}

