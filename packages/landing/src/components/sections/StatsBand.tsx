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
    <section data-system-section="stats" className="relative z-20 w-full border-y border-amber-400/40 bg-gradient-to-r from-[#FFD700] via-[#FFB800] to-[#CCA000] text-black shadow-[0_0_50px_rgba(255,184,0,0.25)]">
      <div className="mx-auto grid max-w-[1500px] gap-px bg-black/20 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([value, label]) => (
          <div key={value} className="bg-gradient-to-b from-[#FFD700]/90 to-[#FFB800] px-6 py-8 md:px-10 md:py-10 transition-colors hover:from-white/30 hover:to-[#FFD700]">
            <div className="text-2xl font-black tracking-[-0.04em] text-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)] md:text-3xl">{value}</div>
            <div className={`mt-2 text-[9px] tracking-[0.18em] text-black/70 font-bold ${label.includes('indii') ? 'font-sans normal-case' : 'font-mono uppercase'}`}>{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
