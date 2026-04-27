'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  BrainCircuit,
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
  Zap,
  type LucideIcon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Hub-and-Spoke Animated Visualization                               */
/* ------------------------------------------------------------------ */

interface SpokeNode {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;      // hex
  angle: number;       // degrees around the circle
}

const spokes: SpokeNode[] = [
  { id: 'distribution', label: 'Distribution', icon: Globe, color: '#f59e0b', angle: 0 },
  { id: 'creative', label: 'Creative', icon: Sparkles, color: '#a855f7', angle: 24 },
  { id: 'music', label: 'Music', icon: AudioWaveform, color: '#22d3ee', angle: 48 },
  { id: 'legal', label: 'Legal', icon: Scale, color: '#3b82f6', angle: 72 },
  { id: 'finance', label: 'Finance', icon: DollarSign, color: '#34d399', angle: 96 },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, color: '#f43f5e', angle: 120 },
  { id: 'publishing', label: 'Publishing', icon: BookOpen, color: '#fb923c', angle: 144 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, color: '#38bdf8', angle: 168 },
  { id: 'brand', label: 'Brand', icon: Palette, color: '#ec4899', angle: 192 },
  { id: 'video', label: 'Video', icon: Video, color: '#8b5cf6', angle: 216 },
  { id: 'social', label: 'Social', icon: Share2, color: '#6366f1', angle: 240 },
  { id: 'licensing', label: 'Licensing', icon: Key, color: '#facc15', angle: 264 },
  { id: 'merchandise', label: 'Merch', icon: ShoppingBag, color: '#a3e635', angle: 288 },
  { id: 'publicist', label: 'Publicist', icon: Newspaper, color: '#2dd4bf', angle: 312 },
  { id: 'road', label: 'Road', icon: MapPin, color: '#f87171', angle: 336 },
];

function OrbitalVisualization() {
  const radius = 180; // Orbit radius in px

  return (
    <div className="relative w-full max-w-[420px] aspect-square mx-auto flex-shrink-0 flex items-center justify-center overflow-hidden">
      <div className="relative w-[420px] h-[420px] scale-[0.7] sm:scale-100 flex-shrink-0">
        {/* Outer Orbit Ring */}
        <div className="absolute inset-4 rounded-full border border-white/[0.04]" />
        <div className="absolute inset-12 rounded-full border border-white/[0.03]" />

      {/* Rotating container for all spoke nodes */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
      >
        {spokes.map((spoke) => {
          const rad = (spoke.angle * Math.PI) / 180;
          const x = Math.cos(rad) * radius;
          const y = Math.sin(rad) * radius;

          return (
            <motion.div
              key={spoke.id}
              className="absolute flex flex-col items-center"
              style={{
                left: `calc(50% + ${x}px - 18px)`,
                top: `calc(50% + ${y}px - 18px)`,
              }}
              /* Counter-rotate so icons stay upright */
              animate={{ rotate: -360 }}
              transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
            >
              {/* Connection line to center */}
              <div
                className="absolute w-px opacity-[0.08]"
                style={{
                  background: spoke.color,
                  height: `${radius - 20}px`,
                  transformOrigin: 'top center',
                  transform: `rotate(${spoke.angle + 90}deg)`,
                  left: '18px',
                  top: '18px',
                }}
              />

              {/* Node */}
              <div
                className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center backdrop-blur-md transition-all duration-300 hover:scale-125 cursor-pointer group relative"
                style={{
                  background: `${spoke.color}15`,
                  boxShadow: `0 0 12px ${spoke.color}20`,
                }}
              >
                <spoke.icon size={16} style={{ color: spoke.color }} />

                {/* Tooltip */}
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  <span
                    className="text-[9px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded-md"
                    style={{ color: spoke.color, background: `${spoke.color}15` }}
                  >
                    {spoke.label}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Data pulse rings */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
      >
        <div className="w-40 h-40 rounded-full border border-amber-500/30" />
      </motion.div>
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.2, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeOut', delay: 1 }}
      >
        <div className="w-56 h-56 rounded-full border border-amber-500/20" />
      </motion.div>

      {/* Center Hub — The Conductor */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          {/* Glow */}
          <div className="absolute -inset-6 bg-amber-500/20 rounded-full blur-3xl" />

          {/* Core */}
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/10 border border-amber-500/30 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.3)]">
            <BrainCircuit className="text-amber-400" size={36} strokeWidth={1.5} />
          </div>
        </motion.div>
      </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Capabilities List                                                  */
/* ------------------------------------------------------------------ */

const hubCapabilities = [
  {
    icon: Zap,
    title: 'From Vision to Reality',
    description: 'Turn your simple ideas into a full career strategy. You set the vision; the Conductor executes the plan across your entire creative ecosystem.',
  },
  {
    icon: Globe,
    title: 'Unified Flow',
    description: 'Autonomous orchestration of your specialist team. The Conductor ensures every move aligns with your brand and protects your identity.',
  },
  {
    icon: BrainCircuit,
    title: 'Instant Global Impact',
    description: 'Execute your entire release in seconds. Global distribution, legal guard, and creative assets—all delivered in a single, unified move.',
  },
  {
    icon: BarChart3,
    title: 'Total Clarity',
    description: 'Complete transparency into every action. Always see exactly how your team is moving the needle on your career and your independence.',
  },
];

/* ------------------------------------------------------------------ */
/*  Main Export                                                        */
/* ------------------------------------------------------------------ */

export default function ConductorSection() {
  return (
    <section className="w-full max-w-7xl px-4 py-20 md:py-32 z-20 relative mx-auto overflow-hidden">
      {/* Section Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="text-center mb-20"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold tracking-[0.2em] uppercase mb-8 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <BrainCircuit size={12} />
          The Operating System for Independence
        </div>
        <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6">
          Your Vision.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-600 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">
            Seamless Orchestration.
          </span>
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed font-light">
          The indii Conductor is your mission control for independence. Tell it what you want
          to achieve, and it coordinates your specialist team to handle the labor—leaving you 
          free to stay focused on the art.
        </p>
      </motion.div>

      {/* Content: Visualization + Capabilities */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-24">
        {/* Left: Orbital Viz */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="w-full lg:w-auto flex justify-center flex-shrink-0"
        >
          <OrbitalVisualization />
        </motion.div>

        {/* Right: Capabilities */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {hubCapabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group"
            >
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-amber-500/20 transition-all duration-500 h-full">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(245,158,11,0.15)] group-hover:scale-110 transition-transform duration-500">
                  <cap.icon className="text-amber-400" size={18} />
                </div>
                <h4 className="text-white font-bold mb-2 tracking-tight">{cap.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed font-light">
                  {cap.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom: "Try it" prompt example */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="mt-20 max-w-3xl mx-auto"
      >
        <div className="rounded-2xl bg-[#0a0a0a] border border-white/[0.06] p-6 md:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <BrainCircuit size={12} className="text-amber-400" />
            </div>
            <span className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-gray-500">
              Example Workflow
            </span>
          </div>
          <p className="text-white text-lg md:text-xl font-medium leading-relaxed mb-4">
            &ldquo;I just finished my new single. Share it to every store, 
            build a visual world around it, protect my rights, and 
            help me find my audience.&rdquo;
          </p>
          <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Conductor routing to 5 agents
            </span>
            <span className="text-white/10">|</span>
            <span>Distribution → Creative → Publicist → Marketing → Social</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
