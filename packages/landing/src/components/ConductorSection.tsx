'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Check, CornerDownRight } from 'lucide-react';

interface RoutedDept {
  name: string;
  hex: string;
  glow: string;
}

const routedDepartments: RoutedDept[] = [
  { name: 'Delivery Preparation', hex: '#2196F3', glow: 'rgba(33, 150, 243, 0.3)' },
  { name: 'Creative', hex: '#00FF66', glow: 'rgba(0, 255, 102, 0.3)' },
  { name: 'Rights', hex: '#009688', glow: 'rgba(0, 150, 136, 0.3)' },
  { name: 'Marketing', hex: '#E91E63', glow: 'rgba(233, 30, 99, 0.3)' },
  { name: 'Social', hex: '#00BCD4', glow: 'rgba(0, 188, 212, 0.3)' },
];

const workingSteps = [
  {
    number: '01',
    label: 'Say what you need',
    text: 'Start with the outcome in your own language. You do not need to know which department or tool should handle it.',
  },
  {
    number: '02',
    label: 'See the plan',
    text: 'indii conducts the request, turns it into visible work, and brings in the right parts of the system.',
  },
  {
    number: '03',
    label: 'Review the work',
    text: 'Plans, assets, records, and proposed high-impact actions stay available for artist review instead of disappearing into a black box.',
  },
  {
    number: '04',
    label: 'Keep the record',
    text: 'Approved work returns to the project, where the next department can use the same context without asking you to start over.',
  },
];

export default function ConductorSection() {
  return (
    <section id="conductor" data-system-section="conductor" className="relative z-20 w-full overflow-hidden border-t border-white/10 bg-[#0D0A07]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(245,158,11,0.16),transparent_38%)]" />

      <div className="relative mx-auto max-w-[1500px] px-5 py-28 md:px-10 md:py-40">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]"
        >
          <div>
            <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-amber-400">
              <span className="indii-name">indii</span>, in motion
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/50">
              indii is the conductor and the orchestra: one working system that hears the direction, coordinates the departments, and carries the work.
            </p>
          </div>
          <div>
            <h2 className="max-w-5xl text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-6xl md:text-8xl lg:text-[7.8rem]">
              One direction.
              <span className="block text-amber-400 [text-shadow:0_0_35px_rgba(255,184,0,0.4)]">The whole system moves.</span>
            </h2>
            <p className="mt-10 max-w-2xl text-lg leading-relaxed text-white/60 md:text-xl">
              You should not have to become the integration layer for your own career. Give indii the direction. The same system can shape the plan, coordinate
              the specialists, and return the work to one artist-controlled project.
            </p>
          </div>
        </motion.div>

        <div className="mt-24 grid items-start gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="card-shade-gold relative overflow-hidden rounded-2xl shadow-[0_30px_90px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
          >
            <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold" />
            <div className="flex items-center justify-between border-b border-amber-500/20 bg-[#0E0B08]/90 px-6 py-4 font-mono text-[9px] uppercase tracking-[0.25em] text-white/50">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                <span className="ml-3 font-bold tracking-[0.2em] text-amber-200">Artist request / 001</span>
              </div>
              <span className="flex items-center gap-2 font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                Ready for review
              </span>
            </div>

            <div className="px-6 py-10 md:px-10 md:py-14">
              <div className="mb-5 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#FFB800] [text-shadow:0_0_12px_rgba(255,184,0,0.6)]">Your direction</div>
              <p className="max-w-3xl text-2xl font-semibold leading-snug tracking-[-0.025em] text-white md:text-4xl">
                “My single is finished. Prepare the release, build the visual direction, organize the rights information, and give me a campaign I can review.”
              </p>
            </div>

            <div className="border-t border-amber-500/20 px-6 py-8 md:px-10">
              <div className="mb-6 flex items-center gap-3 font-mono text-[9px] font-bold uppercase tracking-[0.23em] text-[#FFB800]">
                <CornerDownRight size={13} className="text-[#FFB800]" />
                Routed work
              </div>
              <div className="flex flex-wrap gap-2.5">
                {routedDepartments.map((dept, index) => (
                  <motion.div
                    key={dept.name}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.12 * index }}
                    style={{
                      borderColor: `${dept.hex}70`,
                      backgroundColor: `${dept.hex}22`,
                      boxShadow: `0 0 20px -2px ${dept.glow}`,
                    }}
                    className="flex items-center gap-2.5 rounded-full border px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white transition-all hover:scale-[1.04]"
                  >
                    <span className="font-bold" style={{ color: dept.hex }}>0{index + 1}</span>
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: dept.hex, boxShadow: `0 0 10px ${dept.hex}` }}
                    />
                    <span>{dept.name}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="grid gap-px border-t border-amber-500/20 bg-amber-500/20 sm:grid-cols-3">
              {[
                ['Plan', 'Visible'],
                ['Actions', 'Reviewable'],
                ['Project context', 'Shared'],
              ].map(([label, value]) => (
                <div key={label} className="bg-[#100C08] px-6 py-6">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-bold text-white/95">
                    <Check size={14} className="text-[#FFB800]" />
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="border-t border-white/10">
            {workingSteps.map((step, index) => {
              const stepPalette = [
                { hex: '#00BCD4', glow: 'rgba(0,188,212,0.4)', bg: 'bg-[#00BCD4]/15', border: 'border-[#00BCD4]/50', text: 'text-[#00BCD4]' },
                { hex: '#FFB800', glow: 'rgba(255,184,0,0.4)', bg: 'bg-[#FFB800]/15', border: 'border-[#FFB800]/50', text: 'text-[#FFB800]' },
                { hex: '#2196F3', glow: 'rgba(33,150,243,0.4)', bg: 'bg-[#2196F3]/15', border: 'border-[#2196F3]/50', text: 'text-[#2196F3]' },
                { hex: '#00FF66', glow: 'rgba(0,255,102,0.4)', bg: 'bg-[#00FF66]/15', border: 'border-[#00FF66]/50', text: 'text-[#00FF66]' },
              ][index] || { hex: '#FFB800', glow: 'rgba(255,184,0,0.4)', bg: 'bg-[#FFB800]/15', border: 'border-[#FFB800]/50', text: 'text-[#FFB800]' };

              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: 22 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.55, delay: index * 0.08 }}
                  className="grid grid-cols-[44px_1fr] gap-4 border-b border-white/10 py-7 md:grid-cols-[64px_1fr] md:gap-6"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border ${stepPalette.bg} ${stepPalette.border} font-mono text-[10px] font-black tracking-[0.1em] ${stepPalette.text}`}
                    style={{ boxShadow: `0 0 15px ${stepPalette.glow}` }}
                  >
                    {step.number}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-white md:text-2xl">{step.label}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 md:text-base">{step.text}</p>
                    {index < workingSteps.length - 1 && <ArrowDown size={14} className="mt-5 text-white/30" aria-hidden="true" />}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="mt-24 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/[0.06] via-amber-500/[0.12] to-amber-500/[0.06] py-10 text-center shadow-[0_0_40px_rgba(255,184,0,0.1)]"
        >
          <p className="text-2xl font-semibold tracking-[-0.025em] text-white md:text-4xl">Less tab management. More informed decisions.</p>
        </motion.div>
      </div>
    </section>
  );
}
