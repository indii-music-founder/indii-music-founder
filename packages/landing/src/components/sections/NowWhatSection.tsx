import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Download, Film, Link2, Pause, Play, Volume2 } from 'lucide-react';
import {
  NOW_WHAT_HOOKS,
  nowWhatPosterPath,
  nowWhatSharePath,
  nowWhatVideoPath,
  nowWhatVttPath,
  type NowWhatHook,
} from '@shared/share/nowWhat';
import { buildShareCardModel, shareCardFileName } from '@shared/share/shareCardTemplates';
import { renderShareCard } from '@shared/share/ShareCardRenderer';
import { shareOrDownloadImage } from '@shared/share/shareFile';
import { SIGNATURE_BUTTON_BASE, SIGNATURE_BUTTON_TONES } from '@shared/share/signatureButton';

const gold = SIGNATURE_BUTTON_TONES.gold;
const CYCLE_MS = 4800;

function playDetroitMotif(): void {
  if (typeof window === 'undefined') return;
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    const ctx = new Ctor();
    const now = ctx.currentTime;
    // Warm D-minor 9th harmonic swell (293.66 Hz, 440 Hz, 659.25 Hz)
    const freqs = [293.66, 440, 659.25];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.045 / (idx + 1), now + idx * 0.045 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.045);
      osc.stop(now + 0.7);
    });
    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 850);
  } catch {
    // Audio playback is optional enhancement only.
  }
}

export default function NowWhatSection() {
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [cardBusy, setCardBusy] = useState(false);
  const [playingReelId, setPlayingReelId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const lastAnnouncementRef = useRef('');
  const statusId = useId();

  const activeHook: NowWhatHook = NOW_WHAT_HOOKS[activeIndex] ?? NOW_WHAT_HOOKS[0];

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion || isPaused || isHovered) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % NOW_WHAT_HOOKS.length);
    }, CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [reducedMotion, isPaused, isHovered]);

  const announce = (msg: string) => {
    // Append NBSP on repeats so VoiceOver announces consecutive copies.
    const next = msg === lastAnnouncementRef.current ? `${msg}\u00A0` : msg;
    lastAnnouncementRef.current = next;
    setStatusMessage(next);
  };

  const handleShareHook = async (hook: NowWhatHook) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://indii.music';
    const url = `${origin}${nowWhatSharePath(hook)}`;
    const coarsePointer = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (coarsePointer && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${hook.hook} — indii.music`, text: hook.answer, url });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(hook.id);
      announce(`Copied link for ${hook.hook}`);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedId(null);
        setStatusMessage('');
      }, 2200);
    } catch {
      announce('Copy failed');
    }
  };

  const handleDownloadCard = async (hook: NowWhatHook) => {
    if (cardBusy) return;
    setCardBusy(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://indii.music';
      const model = buildShareCardModel(
        {
          kind: 'nowwhat',
          situation: hook.situation,
          answer: hook.answer,
          url: `${origin}${nowWhatSharePath(hook)}`,
        },
        { brandColors: ['#FFB800', '#E65100'] },
      );
      const { blob } = await renderShareCard(model, 'square');
      const outcome = await shareOrDownloadImage(blob, shareCardFileName(model, 'square'), {
        title: hook.hook,
        text: hook.answer,
      });
      if (outcome !== 'cancelled') {
        announce(outcome === 'shared' ? 'Shared card image' : 'Downloaded card image');
      }
    } catch {
      announce('Could not create share card');
    } finally {
      setCardBusy(false);
    }
  };

  const handleSelectHook = (index: number) => {
    setActiveIndex(index);
    setIsPaused(true);
  };

  return (
    <section
      id="now-what"
      data-system-section="now-what"
      aria-labelledby="now-what-heading"
      className="relative z-20 mx-auto max-w-[1500px] px-5 py-24 text-white md:px-10 md:py-32"
    >
      {/* Kinetic "Now what?" Stage */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative overflow-hidden rounded-3xl border border-white/15 bg-[#080808]/90 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.85)] backdrop-blur-xl md:p-12"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] specular-line-gold" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full blur-[120px] opacity-35"
          style={{ background: 'radial-gradient(circle, rgba(255,184,0,0.65), rgba(230,81,0,0.2), transparent 70%)' }}
        />

        <div className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-[#FFB800] shadow-[0_0_12px_rgba(255,184,0,0.9)]" aria-hidden="true" />
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-[#FFB800]">
              Wherever you are in your music career · {activeHook.moduleLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => playDetroitMotif()}
              aria-label="Hear the Now what studio chime"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/75 transition-colors hover:border-[#FFB800]/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800]"
            >
              <Volume2 size={13} className="text-[#FFB800]" aria-hidden="true" />
              <span>Tone</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPaused((prev) => !prev)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white/75 transition-colors hover:border-[#FFB800]/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800]"
            >
              {isPaused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
              <span>{isPaused ? 'Play' : 'Pause'}</span>
            </button>
          </div>
        </div>

        {/* Situation + Turn */}
        <div className="relative mt-8 min-h-[168px] md:min-h-[200px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeHook.id}
              initial={reducedMotion ? false : { opacity: 0, y: 14, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-3xl font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl md:text-6xl">
                {activeHook.situation}
              </p>
              <h2
                id="now-what-heading"
                className="mt-2 text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-black leading-[1.02] tracking-[-0.045em] text-white"
              >
                Now what?
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75 md:text-lg">
                {activeHook.answer}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Stage Action Bar */}
        <div className="relative mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={`/passport?entry=${activeHook.id}&source=now_what_homepage`}
              className={`${SIGNATURE_BUTTON_BASE} ${gold.button} bg-black/70 px-5 py-2.5 text-sm`}
            >
              <span className={gold.label}>Find my next steps</span>
              <ArrowRight size={15} className={gold.icon} aria-hidden="true" />
              <span aria-hidden="true" className={gold.sweep} />
            </a>

            <button
              type="button"
              onClick={() => void handleShareHook(activeHook)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/90 transition-colors hover:border-[#FFB800]/60 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800]"
            >
              {copiedId === activeHook.id ? (
                <Check size={14} className="text-[#FFB800]" aria-hidden="true" />
              ) : (
                <Link2 size={14} className="text-[#FFB800]" aria-hidden="true" />
              )}
              <span>{copiedId === activeHook.id ? 'Link copied' : 'Share this situation'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleDownloadCard(activeHook)}
              aria-busy={cardBusy}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/15 bg-transparent px-4 py-2 text-xs font-semibold text-white/75 transition-colors hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800]"
            >
              <Download size={14} aria-hidden="true" />
              <span>{cardBusy ? 'Rendering…' : 'Save card'}</span>
            </button>
          </div>

          {/* 01..06 Situation Stepper */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Select artist situation">
            {NOW_WHAT_HOOKS.map((hook, idx) => {
              const selected = idx === activeIndex;
              return (
                <button
                  key={hook.id}
                  type="button"
                  onClick={() => handleSelectHook(idx)}
                  aria-current={selected ? 'true' : undefined}
                  aria-label={`Situation ${idx + 1}: ${hook.hook}`}
                  className={`min-h-[34px] min-w-[34px] rounded-lg border px-2.5 font-mono text-[11px] font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800] ${
                    selected
                      ? 'border-[#FFB800] bg-[#FFB800]/15 text-[#FFB800]'
                      : 'border-white/10 bg-white/[0.02] text-white/50 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {String(idx + 1).padStart(2, '0')}
                </button>
              );
            })}
          </div>
        </div>

        <p id={statusId} role="status" aria-live="polite" className="sr-only">
          {statusMessage}
        </p>
      </div>

      {/* Answer Cards Grid */}
      <p className="mt-10 max-w-2xl text-sm text-white/65 md:text-base">
        You make the music. We help you figure out what comes next. Start with a free Artist Passport assessment.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NOW_WHAT_HOOKS.map((c, idx) => {
          const isCurrent = idx === activeIndex;
          const isCopied = copiedId === c.id;
          return (
            <article
              key={c.id}
              className={`group relative flex flex-col justify-between rounded-2xl border p-6 transition-colors ${
                isCurrent
                  ? 'border-[#FFB800]/50 bg-[#0d0b06]'
                  : 'border-white/15 bg-black/60 hover:border-[#FFB800]/70'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#FFB800]/80">
                  {String(idx + 1).padStart(2, '0')} · {c.moduleLabel}
                </span>
                <button
                  type="button"
                  onClick={() => void handleShareHook(c)}
                  aria-label={`Share link for “${c.hook}”`}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-white/70 transition-colors hover:border-[#FFB800]/60 hover:text-[#FFB800] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800]"
                >
                  {isCopied ? <Check size={11} className="text-[#FFB800]" aria-hidden="true" /> : <Link2 size={11} aria-hidden="true" />}
                  <span>{isCopied ? 'Copied' : 'Share'}</span>
                </button>
              </div>

              <a
                href={`/passport?entry=${c.id}&source=now_what_homepage`}
                className="mt-4 block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800]"
              >
                <h3 className="text-lg font-bold text-white transition-colors group-hover:text-[#FFB800]">
                  {c.hook}
                </h3>
                <p className="mt-3 text-sm text-white/70">{c.answer}</p>
                <span className="mt-5 inline-block text-sm font-bold text-[#FFB800]">
                  Find my next steps →
                </span>
              </a>
            </article>
          );
        })}
      </div>

      {/* Vertical 9:16 "Now what?" Film Reel Strip */}
      <div className="mt-14 border-t border-white/10 pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Film size={16} className="text-[#FFB800]" aria-hidden="true" />
            <h3 className="font-mono text-xs uppercase tracking-[0.22em] text-[#FFB800]">
              Now what? — 9:16 Vertical Reels
            </h3>
          </div>
          <p className="text-xs text-white/55">
            Click a reel to preview or download the vertical MP4 for Stories, Reels, or Shorts.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {NOW_WHAT_HOOKS.map((hook) => {
            const isPlaying = playingReelId === hook.id;
            return (
              <div
                key={`reel-${hook.id}`}
                className="group overflow-hidden rounded-2xl border border-white/15 bg-[#080808] p-2 transition-colors hover:border-[#FFB800]/60"
              >
                <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-black">
                  <video
                    src={nowWhatVideoPath(hook)}
                    poster={nowWhatPosterPath(hook)}
                    preload="none"
                    muted
                    loop
                    playsInline
                    controls={isPlaying}
                    autoPlay={isPlaying && !reducedMotion}
                    aria-label={`${hook.hook} vertical preview`}
                    className="h-full w-full object-cover"
                  >
                    <track src={nowWhatVttPath(hook)} kind="captions" srcLang="en" label="English" />
                  </video>
                  {!isPlaying && (
                    <button
                      type="button"
                      onClick={() => setPlayingReelId(hook.id)}
                      aria-label={`Play reel for ${hook.hook}`}
                      className="absolute inset-0 flex items-end justify-start bg-gradient-to-t from-black/75 via-transparent to-transparent p-3 text-left transition-opacity hover:from-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800]"
                    >
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FFB800]/50 bg-black/80 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#FFB800]">
                        <Play size={10} aria-hidden="true" /> Play
                      </span>
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 px-1 pb-1">
                  <span className="truncate font-mono text-[10px] text-white/65">{hook.moduleLabel}</span>
                  <a
                    href={nowWhatVideoPath(hook)}
                    download={`indii-now-what-${hook.id}.mp4`}
                    aria-label={`Download ${hook.hook} vertical video`}
                    className="inline-flex min-h-[28px] items-center gap-1 rounded-md border border-white/15 px-2 py-0.5 font-mono text-[10px] text-white/80 transition-colors hover:border-[#FFB800]/60 hover:text-[#FFB800] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB800]"
                  >
                    <Download size={10} aria-hidden="true" /> MP4
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
