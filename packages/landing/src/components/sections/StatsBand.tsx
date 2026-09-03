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
    <section data-system-section="stats" className="relative z-20 w-full overflow-hidden border-y border-amber-400/60 bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] text-black shadow-[0_0_60px_rgba(255,184,0,0.35)]">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-white/60 via-white/90 to-white/60" />
      <div className="mx-auto grid max-w-[1500px] gap-px bg-black/30 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([value, label]) => (
          <div key={value} className="relative bg-gradient-to-b from-[#FFE57F] via-[#FFCA28] to-[#FFB300] px-6 py-8 transition-all hover:brightness-105 md:px-10 md:py-10">
            <div className="text-2xl font-black tracking-[-0.04em] text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.6)] md:text-3xl">{value}</div>
            <div className={`mt-2 text-[9px] tracking-[0.18em] text-black/85 font-black ${label.includes('indii') ? 'font-sans normal-case' : 'font-mono uppercase'}`}>{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
