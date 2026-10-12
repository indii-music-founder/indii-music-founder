import React from 'react';
import { NOW_WHAT_CAMPAIGNS } from '../../lib/nowWhatCampaign';

export default function NowWhatSection() {
  return <section id="now-what" aria-labelledby="now-what-heading" className="relative mx-auto max-w-6xl px-6 py-20 text-white">
    <p className="text-sm font-mono text-[#FFB800]">Wherever you are in your music career</p>
    <h2 id="now-what-heading" className="mt-3 text-4xl font-bold">Now what?</h2>
    <p className="mt-4 max-w-2xl text-white/70">You make the music. We help you figure out what comes next. Start with a free Artist Passport assessment.</p>
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {NOW_WHAT_CAMPAIGNS.map(c => <a key={c.id} href={`/passport?entry=${c.id}&source=now_what_homepage`} className="rounded-2xl border border-white/15 bg-black/60 p-6 hover:border-[#FFB800] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800]">
        <h3 className="text-lg font-bold">{c.hook}</h3>
        <p className="mt-3 text-sm text-white/70">{c.answer}</p>
        <span className="mt-5 inline-block text-sm font-bold text-[#FFB800]">Find my next steps →</span>
      </a>)}
    </div>
  </section>;
}
