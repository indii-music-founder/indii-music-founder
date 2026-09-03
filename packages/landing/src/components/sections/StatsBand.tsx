'use client';

import React from 'react';

const stats: Array<[string, string]> = [
  ['One workspace', 'Projects and career operations'],
  ['Artist controlled', 'You remain the decision-maker'],
  ['Connected work', 'Shared project context'],
  ['0% royalty share', 'indii is software, not your label'],
];

export default function StatsBand() {
  return (
    <section data-system-section="stats" className="relative z-20 w-full overflow-hidden border-y border-white/10 bg-black text-white shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
      <div className="absolute inset-x-0 top-0 h-[1px] specular-line-gold" />
      <div className="mx-auto grid max-w-[1500px] gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([value, label]) => (
          <div key={value} className="relative bg-black/90 px-6 py-8 transition-all hover:bg-white/[0.03] md:px-10 md:py-10">
            <div className="text-2xl font-black tracking-[-0.04em] text-white [text-shadow:0_0_20px_rgba(255,255,255,0.2)] md:text-3xl">
              <span className="text-[#FFB800] [text-shadow:0_0_20px_rgba(255,184,0,0.4)]">{value}</span>
            </div>
            <div className={`mt-2 text-[9px] tracking-[0.18em] text-white/60 font-semibold ${label.includes('indii') ? 'font-sans normal-case' : 'font-mono uppercase'}`}>{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
