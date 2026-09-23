import React from 'react';
import { CarFront, Clapperboard, MapPinned, Shirt } from 'lucide-react';

const details = [
  {
    title: 'Remember the miles, too.',
    description: 'Log the drive to rehearsal, a gig, or a gear pickup. Keep the miles and the reason for the trip with your business records.',
    icon: CarFront,
  },
  {
    title: 'Find the room. Prepare the show.',
    description: 'Research venues that fit your music, save the ones worth contacting, and prepare the day sheet and technical rider when a date takes shape.',
    icon: MapPinned,
  },
  {
    title: 'Give a long video another life.',
    description: 'Make a separate social edit from a longer recording or finished video. Choose a vertical or feed format and refine the cut without changing the original.',
    icon: Clapperboard,
  },
  {
    title: 'Put your artwork on a shirt.',
    description: 'Bring an image from your creative work or upload one of your own. Lay it out in the merch designer, preview it, and prepare the design for print on demand.',
    icon: Shirt,
  },
];

export default function OverlookedWorkSection() {
  return (
    <section data-system-section="overlooked-work" aria-labelledby="overlooked-work-title" className="relative z-20 border-t border-white/10 bg-[#090909] py-24 md:py-32">
      <div className="mx-auto max-w-[1500px] px-5 md:px-10">
        <div className="max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-400">The work around the music</p>
          <h2 id="overlooked-work-title" className="mt-5 text-4xl font-black leading-tight tracking-[-0.045em] text-white sm:text-5xl md:text-6xl">
            The little things add up to a career.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-white/65 md:text-lg">
            A release needs more than artwork and a date. Keep the travel, shows, videos, and merch moving alongside the music.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {details.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <Icon size={24} className="text-amber-400" aria-hidden="true" />
              <h3 className="mt-5 text-xl font-bold tracking-tight text-white md:text-2xl">{title}</h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 md:text-base">{description}</p>
            </article>
          ))}
        </div>

        <p className="mt-8 max-w-3xl border-l-2 border-amber-400/60 pl-5 text-sm leading-relaxed text-white/65">
          <span className="font-bold text-amber-400">Planned:</span> a direct artist storefront where fans can buy your merch. Merch design and production preparation are part of the beta; a fan-facing shop is still ahead.
        </p>
      </div>
    </section>
  );
}
