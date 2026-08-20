'use client';

import React from 'react';

const stats: Array<[string, string]> = [
  ['One workspace', 'Projects and career operations'],
  ['24 connected departments', 'The public operating model'],
  ['Artist review', 'High-impact actions stay visible'],
  ['0% royalty share', 'indii is software, not your label'],
];

export default function StatsBand() {
  return (
    <section data-system-section="stats" className="relative z-20 w-full border-y border-white/10 bg-amber-400 text-black">
      <div className="mx-auto grid max-w-[1500px] gap-px bg-black/15 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([value, label]) => (
          <div key={value} className="bg-amber-400 px-6 py-8 md:px-10 md:py-10">
            <div className="text-2xl font-black tracking-[-0.04em] md:text-3xl">{value}</div>
            <div className={`mt-2 text-[9px] tracking-[0.18em] text-black/60 ${label.includes('indii') ? 'font-sans normal-case' : 'font-mono uppercase'}`}>{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
