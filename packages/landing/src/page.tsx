'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowDown,
  ArrowRight,
  Check,
  Film,
  MapPin,
  Play,
} from 'lucide-react';
import { useAuth } from './components/auth/AuthProvider';
import { getStudioPreviewUrl, getStudioUrl } from './lib/auth';
import { flushFounderFunnelQueue, trackFounderFunnelEvent } from './lib/founderFunnel';
import { isFounderPreviewEnabled } from './lib/previewAccess';
import AgentGrid from './components/AgentGrid';
import ConductorSection from './components/ConductorSection';
import ThesisCrawl from './components/ThesisCrawl';

const heroWords = ['Run', 'your', 'music', 'career', 'without', 'giving', 'it', 'away.'];

const ambientStars = Array.from({ length: 72 }, (_, index) => ({
  left: `${(index * 37.31) % 100}%`,
  top: `${(index * 61.73) % 100}%`,
  size: `${index % 9 === 0 ? 2 : index % 4 === 0 ? 1.5 : 1}px`,
  opacity: 0.12 + ((index * 17) % 48) / 100,
}));

const operatingPrinciples = [
  {
    number: '01',
    label: 'Bring the project',
    title: 'Start with the work you already have.',
    text: 'Audio, notes, files, release information, and business records belong to the same project—not a scavenger hunt across disconnected apps.',
  },
  {
    number: '02',
    label: 'Name the outcome',
    title: 'Ask for the result in plain language.',
    text: 'You should not need to understand the product architecture before you can move your release, catalog, campaign, or tour forward.',
  },
  {
    number: '03',
    label: 'Review the plan',
    title: 'See what will happen before it happens.',
    text: 'The work is divided into visible steps. Proposed high-impact actions and important project decisions remain available for review.',
  },
  {
    number: '04',
    label: 'Keep the record',
    title: 'Let the next move begin with context.',
    text: 'Approved assets and decisions return to the project so every department can work from the same facts without making you repeat yourself.',
  },
];

const founderIncludes = [
  'Lifetime access to the Founder edition',
  'Boardroom and Conductor access',
  'Guided Project White Glove onboarding',
  'Founder-level product updates',
  'Permanent founder recognition',
  'No recurring platform subscription',
];

export default function Home({ founder = true }: { founder?: boolean }) {
  const { user, loading } = useAuth();
  const { scrollYProgress } = useScroll();
  const previewEnabled = isFounderPreviewEnabled();
  const previewHref = previewEnabled ? getStudioPreviewUrl() : '#preview-status';
  const hasTrackedFounderView = useRef(false);
  const [isThesisOpen, setIsThesisOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const { hostname, search, hash } = window.location;
    return hostname.includes('founders') || search.includes('thesis=true') || hash.includes('#thesis');
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.13], [1, 0.14]);
  const heroScale = useTransform(scrollYProgress, [0, 0.16], [1, 0.93]);
  const heroY = useTransform(scrollYProgress, [0, 0.16], [0, 90]);

  useEffect(() => {
    flushFounderFunnelQueue();
    if (founder && !hasTrackedFounderView.current) {
      hasTrackedFounderView.current = true;
      void trackFounderFunnelEvent(
        'founder_site_view',
        {
          surface: 'landing_home',
          variant: user ? 'returning' : 'new',
        },
        {
          userId: user?.uid ?? null,
          email: user?.email ?? null,
        },
      );
    }
  }, [founder, user]);

  useEffect(() => {
    const schemaScript = document.createElement('script');
    schemaScript.type = 'application/ld+json';
    schemaScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://indii.music/#organization',
          name: 'indii.music',
          url: 'https://indii.music',
          description:
            'An artist-controlled workspace for the work around an independent music career.',
        },
        {
          '@type': 'WebSite',
          '@id': 'https://founder.indii.music/#website',
          url: 'https://founder.indii.music',
          name: 'indii.music Founder Access',
          publisher: { '@id': 'https://indii.music/#organization' },
        },
        {
          '@type': 'Product',
          '@id': 'https://founder.indii.music/#product',
          name: 'indii.music Founder Access',
          description:
            'A one-time software purchase for lifetime access to the indii.music Founder edition, guided onboarding, Boardroom, Conductor, and founder-level updates.',
          offers: {
            '@type': 'Offer',
            url: 'https://founder.indii.music',
            price: '2500',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            seller: { '@id': 'https://indii.music/#organization' },
          },
        },
      ],
    });
    document.head.appendChild(schemaScript);
    return () => schemaScript.remove();
  }, []);

  const trackPreview = (location: string) => {
    void trackFounderFunnelEvent(
      'founder_preview_cta_clicked',
      {
        location,
        target: previewEnabled ? 'studio' : 'coming_soon',
        label: previewEnabled ? 'Enter Founder Preview' : 'Preview coming soon',
      },
      {
        userId: user?.uid ?? null,
        email: user?.email ?? null,
      },
    );
  };

  const handleFounderInterestClick = async (location: string) => {
    await trackFounderFunnelEvent(
      'founder_interest_clicked',
      {
        location,
        label: 'Founder Access',
      },
      {
        userId: user?.uid ?? null,
        email: user?.email ?? null,
      },
    );
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#020202] font-sans text-white selection:bg-amber-400/30">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 opacity-70">
          {ambientStars.map((star, index) => (
            <span
              key={index}
              className="absolute rounded-full bg-white"
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              }}
            />
          ))}
        </div>
        <div className="absolute left-1/2 top-[-32rem] h-[68rem] w-[68rem] -translate-x-1/2 rounded-full bg-amber-500/[0.08] blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_15%,#020202_82%)]" />
        <div className="absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:80px_80px]" />
      </div>

      <nav
        className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/65 backdrop-blur-2xl"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center justify-between px-5 md:px-10">
          <a
            href="#home"
            className="text-[15px] font-bold tracking-[-0.025em] text-white transition-colors hover:text-amber-400"
            aria-label="indii.music home"
          >
            indii.music
          </a>

          <div className="hidden items-center gap-7 font-mono text-[9px] uppercase tracking-[0.2em] text-white/45 md:flex">
            <a href="#capabilities" className="transition-colors hover:text-white">
              The system
            </a>
            <a href="#conductor" className="transition-colors hover:text-white">
              Conductor
            </a>
            {founder && (
              <button type="button" onClick={() => setIsThesisOpen(true)} className="transition-colors hover:text-white">
                Thesis
              </button>
            )}
            {founder && (
              <a href="#founder-access" className="text-amber-400 transition-colors hover:text-amber-300">
                Founder access
              </a>
            )}
          </div>

          <a
            href={previewHref}
            target={previewEnabled ? '_blank' : undefined}
            rel={previewEnabled ? 'noopener noreferrer' : undefined}
            onClick={() => trackPreview('nav')}
            className="group inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-black transition-transform hover:scale-[1.03] md:px-5"
          >
            <span>
              {previewEnabled
                ? loading
                  ? 'Verifying…'
                  : user
                    ? 'Resume session'
                    : 'Enter preview'
                : 'Preview coming soon'}
            </span>
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </nav>

      <motion.section
        id="home"
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col justify-between px-5 pb-8 pt-28 md:px-10 md:pb-10 md:pt-32"
        aria-label="indii.music founder introduction"
      >
        <div className="flex items-center justify-between border-t border-white/12 pt-4 font-mono text-[9px] uppercase tracking-[0.23em] text-white/30">
          <span>Independent music / operating workspace</span>
          <span className="hidden sm:inline">Detroit, Michigan / Private founder preview</span>
        </div>

        <div className="relative my-auto py-16 md:py-12">
          <div className="absolute left-[58%] top-1/2 h-[38vw] max-h-[620px] min-h-[300px] w-[38vw] min-w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/15">
            <div className="absolute inset-[9%] rounded-full border border-white/[0.05]" />
            <div className="absolute inset-[22%] rounded-full bg-amber-400/[0.07] blur-3xl" />
            <motion.div
              className="absolute inset-[35%] rounded-full bg-amber-300/80 shadow-[0_0_80px_rgba(245,158,11,0.48)]"
              animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.9, 1.04, 0.9] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <h1 className="relative max-w-[1450px] text-[15.4vw] font-black leading-[0.73] tracking-[-0.075em] text-white sm:text-[12.3vw] lg:text-[10.6rem]">
            {heroWords.map((word, index) => (
              <motion.span
                key={`${word}-${index}`}
                initial={{ opacity: 0, y: 50, filter: 'blur(12px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{
                  duration: 0.95,
                  delay: index * 0.055,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={`mr-[0.18em] inline-block last:mr-0 ${
                  word === 'music' || word === 'away.' ? 'text-amber-400' : ''
                }`}
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.72, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative mt-12 grid gap-9 border-t border-white/12 pt-7 md:grid-cols-[1fr_1fr]"
          >
            <div className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.22em] text-white/30">
              The operating system
              <br />
              for musical independence
            </div>
            <div>
              <p className="max-w-2xl text-lg leading-relaxed text-white/60 md:text-xl">
                indii.music brings the work around a release—files, rights, money, campaigns, distribution, and the road—into one artist-controlled workspace.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={previewHref}
                  target={previewEnabled ? '_blank' : undefined}
                  rel={previewEnabled ? 'noopener noreferrer' : undefined}
                  onClick={() => trackPreview('hero')}
                  className="group inline-flex items-center justify-center gap-3 rounded-full bg-amber-400 px-7 py-4 text-sm font-black text-black shadow-[0_0_34px_rgba(245,158,11,0.28)] transition-transform hover:scale-[1.025]"
                >
                  {previewEnabled
                    ? founder
                      ? 'Enter Founder Preview'
                      : 'Enter indii.music'
                    : 'Preview coming soon'}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </a>
                {founder && (
                  <button
                    type="button"
                    onClick={() => setIsThesisOpen(true)}
                    className="group inline-flex items-center justify-center gap-3 rounded-full border border-white/15 px-7 py-4 text-sm font-bold text-white transition-colors hover:border-amber-400/50 hover:text-amber-300"
                  >
                    <Play size={14} fill="currentColor" />
                    Watch the thesis
                  </button>
                )}
              </div>
              {founder && (
                <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-white/25">
                  {previewEnabled
                    ? 'Explore before you buy / no payment required for the preview'
                    : 'Explore the system here / product entry remains private for now'}
                </p>
              )}
            </div>
          </motion.div>
        </div>

        <a
          href="#detroit"
          className="flex items-center justify-between border-t border-white/12 pt-4 font-mono text-[9px] uppercase tracking-[0.23em] text-white/30 transition-colors hover:text-white"
        >
          <span>Continue</span>
          <ArrowDown size={14} />
        </a>
      </motion.section>

      {!previewEnabled && (
        <section
          id="preview-status"
          className="relative z-20 scroll-mt-[72px] border-y border-amber-400/20 bg-[#080602]"
          aria-labelledby="preview-status-title"
        >
          <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-12 md:grid-cols-[0.48fr_1fr_0.36fr] md:items-center md:px-10 md:py-14">
            <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.23em] text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.8)]" />
              Preview status / private
            </div>
            <div>
              <h2
                id="preview-status-title"
                className="text-3xl font-black tracking-[-0.045em] text-white md:text-4xl"
              >
                The preview stays private for now.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45 md:text-base">
                We are preparing the Founder preview before opening product access. You can explore the thesis and the working system here; the application itself is not open to the public yet.
              </p>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/30 md:text-right">
              Opening soon
            </div>
          </div>
        </section>
      )}

      {founder && (
        <section id="detroit" className="relative z-20 w-full border-t border-white/10 bg-[#050505]">
          <div className="mx-auto grid max-w-[1500px] gap-16 px-5 py-28 md:px-10 md:py-40 lg:grid-cols-[0.55fr_1.45fr]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="flex flex-col justify-between"
            >
              <div>
                <div className="mb-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
                  <MapPin size={12} />
                  Detroit / 42.3314° N
                </div>
                <p className="max-w-xs text-sm leading-relaxed text-white/40">
                  Built locally around the reality of independent work: too much administration, too many disconnected systems, and not enough time left for the music.
                </p>
              </div>
              <div className="mt-14 hidden font-mono text-[9px] uppercase tracking-[0.22em] text-white/20 lg:block">
                New Detroit Music LLC
                <br />
                Founder build / 2026
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="max-w-5xl text-5xl font-black leading-[0.94] tracking-[-0.055em] text-white md:text-7xl lg:text-[7rem]">
                Built in Detroit for the work
                <span className="block text-amber-400">behind the music.</span>
              </h2>
              <div className="mt-12 grid gap-8 border-t border-white/10 pt-8 md:grid-cols-2">
                <p className="text-lg leading-relaxed text-white/55">
                  indii started with a practical question: what would independent artists need if the departments around a career were tools they controlled?
                </p>
                <div>
                  <p className="text-lg leading-relaxed text-white/55">
                    The answer is not another dashboard full of promises. It is a working place for the files, decisions, business records, creative work, and approvals already surrounding the artist.
                  </p>
                  <p className="mt-9 flex items-center gap-3 text-sm font-semibold text-white">
                    <span className="h-px w-9 bg-amber-400" />
                    wiil, Founder
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {founder && (
        <section className="relative z-20 min-h-[92vh] w-full overflow-hidden border-t border-amber-400/20 bg-black">
          <div className="absolute inset-0">
            {ambientStars.slice(0, 50).map((star, index) => (
              <span
                key={index}
                className="absolute rounded-full bg-white"
                style={{
                  left: star.left,
                  top: star.top,
                  width: star.size,
                  height: star.size,
                  opacity: star.opacity,
                }}
              />
            ))}
            <div className="absolute inset-x-[-15%] bottom-[-45%] h-[80%] rounded-[50%] border-t border-amber-400/40 bg-amber-500/[0.05] shadow-[0_-40px_120px_rgba(245,158,11,0.13)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(245,158,11,0.13),transparent_45%)]" />
          </div>

          <div className="relative mx-auto flex min-h-[92vh] max-w-[1500px] flex-col justify-between px-5 py-12 md:px-10 md:py-16">
            <div className="flex justify-between border-t border-white/10 pt-4 font-mono text-[9px] uppercase tracking-[0.23em] text-white/30">
              <span>The indii thesis</span>
              <span>Episode I / Everything to Everybody</span>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-120px' }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto max-w-6xl py-20 text-center"
            >
              <Film size={24} className="mx-auto mb-8 text-amber-400" />
              <h2 className="text-6xl font-black uppercase leading-[0.82] tracking-[-0.065em] text-white sm:text-7xl md:text-9xl lg:text-[10.5rem]">
                Read the
                <span className="block text-amber-400">argument.</span>
              </h2>
              <p className="mx-auto mt-9 max-w-2xl text-lg leading-relaxed text-white/50 md:text-xl">
                Why an independent artist does not need one more isolated tool. They need the work around the music to understand the work beside it.
              </p>
              <button
                type="button"
                onClick={() => setIsThesisOpen(true)}
                className="group mt-10 inline-flex items-center gap-3 rounded-full bg-amber-400 px-8 py-4 text-sm font-black text-black shadow-[0_0_40px_rgba(245,158,11,0.3)] transition-transform hover:scale-[1.035]"
              >
                Launch cinematic thesis
                <Play size={14} fill="currentColor" />
              </button>
            </motion.div>

            <div className="grid gap-2 border-y border-white/10 py-5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/30 sm:grid-cols-3">
              <span>Six chapters</span>
              <span className="sm:text-center">Artist ownership at the center</span>
              <span className="sm:text-right">Soundtrack optional</span>
            </div>
          </div>
        </section>
      )}

      <section className="relative z-20 w-full border-y border-white/10 bg-amber-400 text-black">
        <div className="mx-auto grid max-w-[1500px] gap-px bg-black/15 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['One workspace', 'Projects and career operations'],
            ['15 connected areas', 'The public operating model'],
            ['Artist review', 'High-impact actions stay visible'],
            ['0% royalty share', 'indii is software, not your label'],
          ].map(([value, label]) => (
            <div key={value} className="bg-amber-400 px-6 py-8 md:px-10 md:py-10">
              <div className="text-2xl font-black tracking-[-0.04em] md:text-3xl">{value}</div>
              <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-black/55">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <AgentGrid />
      <ConductorSection />

      <section className="relative z-20 w-full border-t border-white/10">
        <div className="mx-auto max-w-[1500px] px-5 py-28 md:px-10 md:py-40">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="grid gap-12 border-b border-white/10 pb-16 lg:grid-cols-[0.65fr_1.35fr]"
          >
            <div>
              <div className="mb-5 font-mono text-[11px] uppercase tracking-[0.3em] text-amber-400">
                How the work moves
              </div>
            </div>
            <h2 className="max-w-5xl text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white sm:text-6xl md:text-8xl lg:text-[7.5rem]">
              You stay the artist.
              <span className="block text-amber-400">You also stay in control.</span>
            </h2>
          </motion.div>

          <div className="mt-6 border-t border-white/10">
            {operatingPrinciples.map((principle, index) => (
              <motion.article
                key={principle.number}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-70px' }}
                transition={{ duration: 0.65, delay: index * 0.05 }}
                className="grid gap-6 border-b border-white/10 py-10 md:grid-cols-[0.18fr_0.42fr_1fr] md:gap-10 md:py-14"
              >
                <div className="font-mono text-[10px] tracking-[0.22em] text-amber-400">{principle.number}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">{principle.label}</div>
                <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                  <h3 className="text-2xl font-bold leading-tight tracking-[-0.03em] text-white md:text-3xl">
                    {principle.title}
                  </h3>
                  <p className="max-w-xl leading-relaxed text-white/45">{principle.text}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {founder && (
        <section className="relative z-20 w-full border-t border-white/10 bg-[#050505]">
          <div className="mx-auto grid max-w-[1500px] gap-16 px-5 py-28 md:px-10 md:py-40 lg:grid-cols-[1.05fr_0.95fr] lg:gap-24">
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
            >
              <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
                Founder onboarding / Project White Glove
              </div>
              <h2 className="max-w-4xl text-5xl font-black leading-[0.93] tracking-[-0.055em] text-white md:text-7xl lg:text-[6.4rem]">
                Start with your real catalog,
                <span className="block text-amber-400">not an empty dashboard.</span>
              </h2>
              <p className="mt-10 max-w-2xl text-lg leading-relaxed text-white/55">
                Founder onboarding begins by mapping what you already have: masters, stems, split information, registrations, release records, artist accounts, and the files holding it all together.
              </p>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/55">
                We help organize the starting record, identify gaps, and set up the workspace around your actual operation. We do not pretend missing files or registrations can be recovered by magic.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 25 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              className="border border-white/10 bg-black"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
                <span>Catalog intake / founder</span>
                <span className="text-amber-400">Guided</span>
              </div>
              {[
                'Masters and stems',
                'Songwriter and split information',
                'Release metadata',
                'Registrations and rights records',
                'Artist profiles and working accounts',
                'Current projects and open decisions',
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-5 border-b border-white/8 px-6 py-5">
                  <span className="font-mono text-[9px] text-white/20">0{index + 1}</span>
                  <span className="flex-1 text-sm font-medium text-white/65">{item}</span>
                  <Check size={13} className="text-amber-400/70" />
                </div>
              ))}
              <div className="px-6 py-7 text-sm leading-relaxed text-white/35">
                The goal is a reliable starting point—not a promise that every historical gap can be solved automatically.
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {founder && (
        <section id="founder-access" className="relative z-20 w-full overflow-hidden border-t border-amber-400/25 bg-black">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,rgba(245,158,11,0.18),transparent_34%)]" />
          <div className="absolute right-[-12rem] top-1/2 h-[42rem] w-[42rem] -translate-y-1/2 rounded-full border border-amber-400/20">
            <div className="absolute inset-[16%] rounded-full border border-white/[0.06]" />
            <div className="absolute inset-[34%] rounded-full bg-amber-400/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-[1500px] px-5 py-28 md:px-10 md:py-40">
            <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-24">
              <motion.div
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
              >
                <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-400">
                  Private founder release / software access
                </div>
                <h2 className="text-6xl font-black leading-[0.85] tracking-[-0.065em] text-white sm:text-7xl md:text-9xl lg:text-[10rem]">
                  Own the
                  <span className="block text-amber-400">first seat.</span>
                </h2>
                <p className="mt-10 max-w-2xl text-lg leading-relaxed text-white/55 md:text-xl">
                  Founder Access is a one-time purchase of enterprise software access. It is not an investment, security, ownership interest, or promise of financial return.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 25 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                className="border-t border-white/15 pt-7"
              >
                <div className="flex items-end justify-between border-b border-white/10 pb-7">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">One-time purchase</div>
                    <div className="mt-2 text-5xl font-black tracking-[-0.055em] text-white">$2,500</div>
                  </div>
                  <div className="pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-amber-400">Founder edition</div>
                </div>

                <div className="py-5">
                  {founderIncludes.map((item) => (
                    <div key={item} className="flex items-center gap-4 border-b border-white/8 py-4 text-sm text-white/65">
                      <Check size={14} className="text-amber-400" />
                      {item}
                    </div>
                  ))}
                </div>

                <a
                  href={getStudioUrl()}
                  onClick={() => trackPreview('founder_access')}
                  className="group mt-4 inline-flex w-full items-center justify-center gap-3 rounded-full bg-amber-400 px-8 py-5 text-base font-black text-black shadow-[0_0_40px_rgba(245,158,11,0.25)] transition-transform hover:scale-[1.02]"
                >
                  Secure Founder Access
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </a>
                <p className="mt-5 text-xs leading-relaxed text-white/35">
                  If you use indii for your music business, the purchase may qualify as a business software expense. Tax treatment depends on your circumstances; confirm it with your tax professional.
                </p>
              </motion.div>
            </div>

            <div className="mt-20 grid gap-6 border-y border-amber-400/20 py-8 text-sm leading-relaxed text-white/45 md:grid-cols-3">
              <p>
                <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400">What you are buying</span>
                Software access, guided onboarding, and the founder release benefits listed above.
              </p>
              <p>
                <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400">What you are not buying</span>
                Equity, profit participation, a security, or any right to a financial return.
              </p>
              <p>
                <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400">Separate conversations</span>
                Any future investment or strategic participation would require its own written agreement.
              </p>
            </div>
          </div>
        </section>
      )}

      <footer className="relative z-20 w-full border-t border-white/10 bg-[#030303]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-10 px-5 py-12 md:flex-row md:items-end md:justify-between md:px-10 md:py-16">
          <div>
            <div className="text-2xl font-black tracking-[-0.04em] text-white">indii.music</div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/35">
              The operating system for musical independence. Built in Detroit.
            </p>
            <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.18em] text-white/20">© 2026 New Detroit Music LLC</p>
          </div>
          <div className="flex flex-wrap gap-6 font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">
            <a href="/privacy" className="transition-colors hover:text-white">Privacy</a>
            <a href="/terms" className="transition-colors hover:text-white">Terms</a>
            {founder && (
              <a
                href="mailto:wiil@indii.music"
                onClick={(event) => {
                  event.preventDefault();
                  void handleFounderInterestClick('footer').then(() => {
                    window.location.href = 'mailto:wiil@indii.music';
                  });
                }}
                className="text-amber-400 transition-colors hover:text-amber-300"
              >
                Contact wiil
              </a>
            )}
          </div>
        </div>
      </footer>

      {founder && (
        <ThesisCrawl
          isOpen={isThesisOpen}
          onClose={() => setIsThesisOpen(false)}
        />
      )}
    </main>
  );
}
