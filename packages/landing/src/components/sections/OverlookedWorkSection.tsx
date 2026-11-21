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

/**
 * PLACEHOLDER VISUAL — replace with a real capture of the video editor.
 * Deliberately abstract (no fake footage, names or numbers): a wide master,
 * a vertical crop window, and a trimmed clip on a timeline.
 */
function VideoCutPlaceholder() {
  return (
    <div
      data-placeholder="video-cut"
      className="relative mt-5 overflow-hidden rounded-xl border border-white/15 bg-[#0b0b0c]"
    >
      <svg
        viewBox="0 0 640 300"
        role="img"
        aria-label="Illustration: a wide video with a vertical crop selected and a clip trimmed on a timeline"
        className="block h-auto w-full"
      >
        <defs>
          <linearGradient id="vc-master" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#17171a" />
            <stop offset="1" stopColor="#0e0e10" />
          </linearGradient>
        </defs>

        {/* 16:9 master */}
        <rect x="24" y="22" width="360" height="203" rx="8" fill="url(#vc-master)" stroke="rgba(255,255,255,0.14)" />
        <circle cx="204" cy="123" r="22" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.25)" />
        <path d="M197 112 L217 123 L197 134 Z" fill="rgba(255,255,255,0.7)" />

        {/* vertical crop window on the master */}
        <rect x="147" y="22" width="114" height="203" fill="rgba(255,184,0,0.07)" stroke="#FFB800" strokeWidth="1.5" strokeDasharray="5 4" />

        {/* arrow to the 9:16 result */}
        <path d="M398 123 H430" stroke="rgba(255,184,0,0.7)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M424 117 L432 123 L424 129" fill="none" stroke="rgba(255,184,0,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* 9:16 result */}
        <rect x="446" y="22" width="114" height="203" rx="10" fill="rgba(255,184,0,0.06)" stroke="#FFB800" strokeWidth="1.5" />
        <rect x="486" y="30" width="34" height="5" rx="2.5" fill="rgba(255,255,255,0.25)" />
        <path d="M494 118 L514 129 L494 140 Z" fill="rgba(255,255,255,0.6)" />

        {/* timeline */}
        <rect x="24" y="244" width="592" height="40" rx="6" fill="#111113" stroke="rgba(255,255,255,0.1)" />
        {Array.from({ length: 30 }, (_, i) => (
          <line key={i} x1={40 + i * 19.5} x2={40 + i * 19.5} y1="256" y2={i % 5 === 0 ? 272 : 266} stroke="rgba(255,255,255,0.14)" />
        ))}
        <rect x="170" y="250" width="130" height="28" rx="4" fill="rgba(255,184,0,0.28)" stroke="#FFB800" />
        <rect x="170" y="250" width="5" height="28" rx="2" fill="#FFB800" />
        <rect x="295" y="250" width="5" height="28" rx="2" fill="#FFB800" />
        <line x1="236" x2="236" y1="238" y2="290" stroke="#fff" strokeWidth="1.5" />
        <circle cx="236" cy="238" r="4" fill="#fff" />
      </svg>
      <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md border border-white/10 bg-black/85 px-2 py-0.5 font-mono text-[9px] text-amber-400 backdrop-blur-md">
        16:9 Master → 9:16 Social Cut
      </div>
    </div>
  );
}

export default function OverlookedWorkSection() {
  return (
    <section id="overlooked-work" data-system-section="overlooked-work" aria-labelledby="overlooked-work-title" className="relative z-20 border-t border-white/10 bg-[#090909] py-24 md:py-32">
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

        <div className="mt-12 grid items-start gap-4 sm:grid-cols-2">
          {details.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <Icon size={24} className="text-amber-400" aria-hidden="true" />
              <h3 className="mt-5 text-xl font-bold tracking-tight text-white md:text-2xl">{title}</h3>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 md:text-base">{description}</p>
              {title === 'Give a long video another life.' && (
                <VideoCutPlaceholder />
              )}
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
