'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimationFrame, useMotionValue } from 'framer-motion';
import { Volume2, VolumeX, X, Play, Pause, Info, ArrowRight, RotateCcw, Download, ChevronsDown, ChevronsUp } from 'lucide-react';
import { getStudioUrl } from '../lib/auth';
import { loadSoundtrackSource } from '../lib/soundtrack';

interface ThesisCrawlProps {
  isOpen: boolean;
  onClose: () => void;
}

const INTRO_TEXT_MS = 6000;
const LOGO_REVEAL_MS = 3800;
const CRAWL_START_MS = INTRO_TEXT_MS + LOGO_REVEAL_MS;
const CRAWL_PIXELS_PER_SECOND = 36;
// Speed ladder for the HUD stepper: slower (vestibular-safe) through faster.
const SPEED_LADDER: number[] = [0.5, 0.75, 1, 1.5, 2];
const SPEED_LABELS: Record<number, string> = {
  0.5: '0.5x SLOWEST',
  0.75: '0.75x SLOW',
  1: '1.0x NORMAL',
  1.5: '1.5x FAST',
  2: '2.0x FASTER',
};
const THESIS_SOUNDTRACK_SOURCES = [
  '/audio/indii-thesis-theme.mp3',
  '/audio/indii-thesis-theme.m4a',
  '/audio/indii-thesis-theme.wav',
];
const THESIS_PDF_PATH = '/downloads/the-indii-thesis.pdf';
const THESIS_PDF_FILENAME = 'The-indii-Thesis.pdf';
// Once the crawl reaches the signed end card, the looping soundtrack fades
// out over this duration and is released.
const SOUNDTRACK_COMPLETION_FADE_MS = 5000;

/** Vestibular-safe mode: the crawl becomes a static, scrollable transcript. */
const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

/**
 * The thesis body — shared by the cinematic crawl and the vestibular-safe
 * static transcript (prefers-reduced-motion).
 */
function ThesisContent() {
  return (
    <>
                  {/* Thesis Title — uses the founder presentation's flat editorial system. */}
                  <header className="mx-auto w-full max-w-5xl border-y border-white/15 py-12 text-left font-sans [text-shadow:none] md:py-16">
                    <div className="flex items-center justify-between gap-8 font-mono text-[10px] font-medium uppercase tracking-[0.24em] md:text-xs">
                      <span className="text-amber-400">Founder thesis / 01</span>
                      <span className="text-right text-white/35">Detroit / 2026</span>
                    </div>

                    <h2 className="mt-12 text-[4.4rem] font-black leading-[0.8] tracking-[-0.07em] text-white sm:text-[6rem] md:text-[8.5rem] lg:text-[10rem]">
                      The <span className="indii-name">indii</span>
                      <span className="block text-amber-400">thesis.</span>
                    </h2>

                    <div className="mt-12 grid gap-4 border-t border-white/12 pt-6 font-mono text-[10px] font-medium uppercase leading-relaxed tracking-[0.2em] md:grid-cols-[1fr_auto] md:text-xs">
                      <p className="text-white/65">Everything to everybody</p>
                      <p className="text-white/35">
                        <span className="wiil-name">wiil</span>, Founder
                      </p>
                    </div>
                  </header>

                  {/* Intro section */}
                  <div className="space-y-8 text-justify">
                    <p>
                      The conventional startup playbook says: <span className="text-white">"Build for somebody, not everybody. You can't be everything to everyone."</span>
                    </p>
                    <p>
                      That's true — in most industries. A restaurant can't serve every cuisine. A shoe company can't make every shoe. But the music industry isn't like other industries.
                    </p>
                    <p>
                      An independent music artist doesn't need <span className="italic text-white">a</span> thing. They need <span className="italic text-white">every</span> thing. They need a recording studio, a designer, a marketer, a booking agent, a road manager, a publicist, a distributor, a lawyer, a financial advisor, a merch operation, a social media manager, and a strategic planner — all at once.
                    </p>
                    <p>
                      Major labels have entire departments for each of these functions. And in exchange, artists give up their masters, their publishing, and their freedom.
                    </p>
                    <p className="text-center text-white font-black text-3xl md:text-5xl lg:text-6xl my-12 tracking-wide leading-snug">
                      indii is the infrastructure without the surrender.
                    </p>
                  </div>

                  {/* Chapter II */}
                  <div className="space-y-12 text-justify">
                    <h3 className="text-white font-sans font-black tracking-widest text-center text-5xl md:text-6xl lg:text-7xl mt-24 mb-16">
                      EPISODE II: WHAT INDII IS
                    </h3>
                    <p>
                      indii is an operating workspace for independent music artists. Not a recording program. Not a streaming service. It is where the work around a music career can live together.
                    </p>
                    <p>
                      Distribution, audio, creative direction, rights, finance, publishing, licensing, campaigns, social preparation, publicity, touring, merchandise, security, and the project record all work from the same artist-controlled context.
                    </p>
                    <p>
                      Connected areas. One workspace. The artist remains the owner, the decision-maker, and the source of truth.
                    </p>
                    <p className="text-center text-white font-black text-3xl md:text-5xl lg:text-6xl my-12 tracking-wide leading-snug">
                      indii is the conductor and the orchestra.
                    </p>
                    <p>
                      It is where the artist gives the direction and the connected system that carries the work. The Conductor is not a separate product sitting on top of indii. It is indii in motion.
                    </p>
                  </div>

                  {/* Chapter III */}
                  <div className="space-y-12 text-justify">
                    <h3 className="text-white font-sans font-black tracking-widest text-center text-5xl md:text-6xl lg:text-7xl mt-24 mb-16">
                      EPISODE III: THE OPERATING ADVANTAGE
                    </h3>
                    <p>
                      Most music-business tools solve one isolated task. The artist is left carrying information from one system to the next and repairing the gaps by hand.
                    </p>
                    <p>
                      indii starts with shared project context. When rights information changes, the release record can reflect it. When the route changes, the working budget and show record can move with it.
                    </p>
                    <p>
                      indii conducts an artist goal into visible work, brings in the relevant areas, and keeps proposed high-impact actions available for review.
                    </p>
                    <p>
                      Files, notes, voice memos, receipts, locations, assets, and approvals become part of the same working record. The next move begins with context instead of another blank form.
                    </p>
                  </div>

                  {/* Chapter IV */}
                  <div className="space-y-12 text-justify">
                    <h3 className="text-white font-sans font-black tracking-widest text-center text-5xl md:text-6xl lg:text-7xl mt-24 mb-16">
                      EPISODE IV: THE YAGNI PHILOSOPHY
                    </h3>
                    <p>
                      You Aren't Gonna Need It — until you do. indii is built around reusable operating capabilities: projects, files, records, approvals, plans, and the connections between them.
                    </p>
                    <p>
                      A release does not need a special version of your ownership data. A tour does not need a separate version of your artist identity. The same reliable source should serve every part of the work.
                    </p>
                    <p>
                      That is how the product can grow without asking the artist to rebuild their career inside every new feature.
                    </p>
                  </div>

                  {/* Chapter V */}
                  <div className="space-y-12 text-justify">
                    <h3 className="text-white font-sans font-black tracking-widest text-center text-5xl md:text-6xl lg:text-7xl mt-24 mb-16">
                      EPISODE V: THE COMPETITIVE MOAT
                    </h3>
                    <p>
                      The music industry is full of useful single-purpose tools. The problem begins when none of them understand what happened in the tool beside them. The artist becomes the integration layer.
                    </p>
                    <p>
                      indii is designed so the approved visual direction can inform the campaign, the route can inform the working budget, and the rights record can stay attached to the release it governs.
                    </p>
                    <p className="italic text-center text-white font-bold my-16 leading-snug">
                      "The advantage is not one more feature. It is the end of starting over."
                    </p>
                  </div>

                  {/* Chapter VI */}
                  <div className="space-y-12 text-justify pb-96">
                    <h3 className="text-white font-sans font-black tracking-widest text-center text-5xl md:text-6xl lg:text-7xl mt-24 mb-16">
                      EPISODE VI: THE ARTIST KEEPS THE LEVERAGE
                    </h3>
                    <p>
                      A system cannot write the song, guarantee an audience, or manufacture a career. It can remove the administrative drag that keeps talent from getting a fair chance to move.
                    </p>
                    <p>
                      The bedroom producer in Detroit should not need a label-sized staff before they can organize a release, understand the business, and protect the work.
                    </p>
                    <p className="text-white italic mt-32 text-center text-5xl md:text-7xl lg:text-8xl font-light leading-snug">
                      "Give the artist the infrastructure. Keep the ownership with the artist."
                    </p>
                    <p className="text-amber-500/60 text-center font-sans font-bold text-3xl tracking-widest uppercase mt-12 mb-32">
                      <span className="wiil-name">wiil</span>, Founder
                    </p>
                  </div>

    </>
  );
}

export default function ThesisCrawl({ isOpen, onClose }: ThesisCrawlProps) {
  const [isPlaying, setIsPlaying] = useState(!PREFERS_REDUCED_MOTION);
  const [speed, setSpeed] = useState(1); // crawl multiplier; SPEED_LADDER 0.5–2.0
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [introStep, setIntroStep] = useState(PREFERS_REDUCED_MOTION ? 2 : 0); // 0: blue text, 1: logo, 2: crawl
  const [isComplete, setIsComplete] = useState(false);
  const [sequenceVersion, setSequenceVersion] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const synthNodesRef = useRef<OscillatorNode[]>([]);
  const soundtrackRef = useRef<HTMLAudioElement | null>(null);
  const soundtrackObjectUrlRef = useRef<string | null>(null);
  const audioStartingRef = useRef(false);
  const soundtrackFadeIntervalRef = useRef<number | null>(null);
  // Bumped on every stop so an in-flight source load can never attach after
  // the thesis closed or replayed.
  const audioGenerationRef = useRef(0);
  // Set only when the visitor mutes the soundtrack, so replay and reopen
  // respect that choice instead of forcing the music back on.
  const audioOptedOutRef = useRef(false);
  // True while any audio path (soundtrack or synth) is actually live, so a
  // stop that runs before anything ever played does not broadcast a stop.
  const audioActiveRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const audioButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [crawlBounds, setCrawlBounds] = useState(() => ({
    start: typeof window === 'undefined' ? 700 : window.innerHeight * 0.78,
    end: -30000,
  }));
  const crawlY = useMotionValue(crawlBounds.start);

  // Temporary synth fallback. A real soundtrack placed in /public/audio takes priority.
  const startSynthFallback = () => {
    try {
      if (audioContextRef.current) return;
      
      const AudioContextClass =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
      audioActiveRef.current = true;
      setAudioEnabled(true);

      // Create a master volume
      const masterVolume = ctx.createGain();
      masterVolume.gain.setValueAtTime(0.15, ctx.currentTime);
      masterVolume.connect(ctx.destination);

      // Simple modular synthesizer to play an epic cosmic chord progression
      const playNote = (freq: number, startTime: number, duration: number, type: OscillatorType = 'sawtooth') => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        
        // Low-pass filter for a warmer synth feel
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, startTime);
        filter.frequency.exponentialRampToValueAtTime(300, startTime + duration);

        oscGain.gain.setValueAtTime(0, startTime);
        oscGain.gain.linearRampToValueAtTime(0.8, startTime + 0.1);
        oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(masterVolume);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
        
        synthNodesRef.current.push(osc);
      };

      // Play background cosmic synth pad loop
      const now = ctx.currentTime;
      // Epic detuned Detroit synth chords
      // Chord 1: Am (A2, E3, A3, C4)
      playNote(110.00, now, 4.0, 'sawtooth');
      playNote(164.81, now, 4.0, 'sawtooth');
      playNote(220.00, now, 4.0, 'triangle');
      playNote(261.63, now, 4.0, 'triangle');

      // Chord 2: Fmaj7 (F2, C3, F3, A3)
      playNote(87.31, now + 4.0, 4.0, 'sawtooth');
      playNote(130.81, now + 4.0, 4.0, 'sawtooth');
      playNote(174.61, now + 4.0, 4.0, 'triangle');
      playNote(220.00, now + 4.0, 4.0, 'triangle');

      // Chord 3: G7 (G2, D3, G3, B3)
      playNote(98.00, now + 8.0, 4.0, 'sawtooth');
      playNote(146.83, now + 8.0, 4.0, 'sawtooth');
      playNote(196.00, now + 8.0, 4.0, 'triangle');
      playNote(246.94, now + 8.0, 4.0, 'triangle');

      // Chord 4: E7 (E2, B2, E3, G#3)
      playNote(82.41, now + 12.0, 4.0, 'sawtooth');
      playNote(123.47, now + 12.0, 4.0, 'sawtooth');
      playNote(164.81, now + 12.0, 4.0, 'triangle');
      playNote(207.65, now + 12.0, 4.0, 'triangle');

    } catch (e) {
      console.warn('Audio synthesis failed to initialize:', e);
    }
  };

  /** Cancel any in-flight soundtrack fade ramp. */
  const cancelSoundtrackFade = () => {
    if (soundtrackFadeIntervalRef.current !== null) {
      window.clearInterval(soundtrackFadeIntervalRef.current);
      soundtrackFadeIntervalRef.current = null;
    }
  };

  /**
   * Ramp the looping soundtrack to silence, then hand off to a final cleanup.
   * Used when the crawl finishes so the experience always ends in silence,
   * whether the track is longer than the crawl or loops past it.
   */
  const fadeOutSoundtrack = (durationMs: number, onFaded: () => void) => {
    if (!soundtrackRef.current) return;
    cancelSoundtrackFade();
    const startVolume = soundtrackRef.current.volume;
    const fadeStartedAt = performance.now();
    soundtrackFadeIntervalRef.current = window.setInterval(() => {
      const fading = soundtrackRef.current;
      if (!fading) {
        // The soundtrack was stopped or swapped mid-fade; nothing left to ramp.
        cancelSoundtrackFade();
        return;
      }
      const progress = Math.min(1, (performance.now() - fadeStartedAt) / durationMs);
      fading.volume = Math.max(0, startVolume * (1 - progress));
      if (progress >= 1) {
        cancelSoundtrackFade();
        onFaded();
      }
    }, 60);
  };

  const startAudio = async () => {
    if (soundtrackRef.current || audioContextRef.current || audioStartingRef.current) return;
    // The visitor muted the soundtrack; only their toggle brings it back.
    if (audioOptedOutRef.current) return;
    audioStartingRef.current = true;
    const generation = audioGenerationRef.current;

    for (const source of THESIS_SOUNDTRACK_SOURCES) {
      try {
        const loaded = await loadSoundtrackSource(source);
        if (!loaded) continue;
        const { url: objectUrl, audio: soundtrack } = loaded;

        try {
          await soundtrack.play();
          if (audioGenerationRef.current !== generation) {
            // The thesis closed or replayed while this source was loading.
            soundtrack.pause();
            soundtrack.removeAttribute('src');
            soundtrack.load();
            URL.revokeObjectURL(objectUrl);
            return;
          }
          soundtrackRef.current = soundtrack;
          soundtrackObjectUrlRef.current = objectUrl;
          audioActiveRef.current = true;
          setAudioEnabled(true);
          audioStartingRef.current = false;
          // Notify the system layer so the network can react to the music.
          window.dispatchEvent(
            new CustomEvent('indii:thesis-audio', { detail: { element: soundtrack } }),
          );
          return;
        } catch (error) {
          soundtrack.removeAttribute('src');
          soundtrack.load();
          URL.revokeObjectURL(objectUrl);
          // Autoplay with sound was refused because no user activation exists
          // yet (e.g. a deep link straight into the thesis). Keep the supplied
          // track pending instead of degrading to the synth; the first visitor
          // gesture retries via the auto-start effect below.
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            audioStartingRef.current = false;
            return;
          }
        }
      } catch (error) {
        console.warn(`Thesis soundtrack source could not be loaded: ${source}`, error);
      }
    }

    if (audioGenerationRef.current === generation) {
      startSynthFallback();
    }
    audioStartingRef.current = false;
  };

  const stopAudio = () => {
    audioGenerationRef.current += 1;
    cancelSoundtrackFade();
    // Only broadcast a stop if something was actually live, so lifecycle
    // calls that run before any audio started stay silent on the event bus.
    const wasActive = audioActiveRef.current;
    audioActiveRef.current = false;
    if (soundtrackRef.current) {
      soundtrackRef.current.pause();
      soundtrackRef.current.removeAttribute('src');
      soundtrackRef.current.load();
      soundtrackRef.current = null;
    }
    if (soundtrackObjectUrlRef.current) {
      URL.revokeObjectURL(soundtrackObjectUrlRef.current);
      soundtrackObjectUrlRef.current = null;
    }
    synthNodesRef.current.forEach(osc => {
      try {
        osc.stop();
      } catch (_e) {
        // Safe to ignore if oscillator was already stopped
      }
    });
    synthNodesRef.current = [];
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    audioStartingRef.current = false;
    setAudioEnabled(false);
    if (wasActive) {
      window.dispatchEvent(new CustomEvent('indii:thesis-audio-stop'));
    }
  };

  const enableAudio = () => {
    audioOptedOutRef.current = false;
    void startAudio();
  };

  const toggleAudio = () => {
    if (audioEnabled) {
      audioOptedOutRef.current = true;
      stopAudio();
    } else {
      enableAudio();
    }
  };

  useEffect(() => {
    if (!audioEnabled) return;

    if (isPlaying) {
      if (soundtrackRef.current) {
        void soundtrackRef.current.play();
      }
      if (audioContextRef.current?.state === 'suspended') {
        void audioContextRef.current.resume();
      }
    } else {
      soundtrackRef.current?.pause();
      if (audioContextRef.current?.state === 'running') {
        void audioContextRef.current.suspend();
      }
    }
  }, [audioEnabled, isPlaying]);

  // Soundtrack lifecycle with the experience: auto-start on open, stop on
  // close. Opening the thesis always follows a visitor gesture (the "Watch
  // the thesis" click), so playback with sound is allowed; if the browser
  // still refuses (a deep link with no prior interaction), these
  // once-per-gesture listeners retry until the track is actually playing.
  useEffect(() => {
    if (!isOpen) {
      setTimeout(stopAudio, 0);
      return undefined;
    }
    void startAudio();

    const retrySoundtrackStart = () => {
      if (!soundtrackRef.current && !audioContextRef.current) {
        void startAudio();
      }
    };
    const retryEvents: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    retryEvents.forEach((eventName) => {
      window.addEventListener(eventName, retrySoundtrackStart, { once: true });
    });
    return () => {
      retryEvents.forEach((eventName) => {
        window.removeEventListener(eventName, retrySoundtrackStart);
      });
    };
    // startAudio/stopAudio read only refs and setters, so the lifecycle must
    // not re-run just because they are re-created on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sequenceVersion]);

  // Adjust state during render based on props to avoid useEffect setState warning
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setIntroStep(PREFERS_REDUCED_MOTION ? 2 : 0);
      setIsPlaying(!PREFERS_REDUCED_MOTION);
      setSpeed(1);
      setIsComplete(false);
    }
  }

  // Dialog semantics: capture the trigger, focus the first control, restore on close.
  useEffect(() => {
    if (!isOpen) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => {
      audioButtonRef.current?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    const restoreTarget = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (restoreTarget && typeof restoreTarget.focus === 'function') {
      restoreTarget.focus();
    }
  }, [isOpen]);

  // Escape closes; Tab is trapped inside the dialog.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const overlay = overlayRef.current;
      if (!overlay) return;
      const focusables = Array.from(
        overlay.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      if (!PREFERS_REDUCED_MOTION) {
        // Auto-advance intro steps
        const introTimer1 = setTimeout(() => setIntroStep(1), INTRO_TEXT_MS);
        const introTimer2 = setTimeout(() => setIntroStep(2), CRAWL_START_MS);

        return () => {
          clearTimeout(introTimer1);
          clearTimeout(introTimer2);
          document.body.style.overflow = 'unset';
        };
      }

      return () => {
        document.body.style.overflow = 'unset';
      };
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, sequenceVersion]);

  useLayoutEffect(() => {
    if (PREFERS_REDUCED_MOTION) return; // static transcript — no crawl bounds needed
    if (introStep !== 2 || !scrollContainerRef.current) return;

    const crawl = scrollContainerRef.current;
    const measureCrawl = () => {
      setCrawlBounds({
        start: window.innerHeight * 0.78,
        end: -(crawl.scrollHeight + window.innerHeight * 0.35),
      });
    };

    measureCrawl();
    const resizeObserver = new ResizeObserver(measureCrawl);
    resizeObserver.observe(crawl);
    window.addEventListener('resize', measureCrawl);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureCrawl);
    };
  }, [introStep]);

  useEffect(() => {
    if (introStep === 2) {
      crawlY.set(crawlBounds.start);
    }
  }, [crawlBounds.end, crawlBounds.start, crawlY, introStep]);

  useAnimationFrame((_time, delta) => {
    if (PREFERS_REDUCED_MOTION) return;
    if (!isOpen || introStep !== 2 || !isPlaying || isComplete) return;

    const nextY = crawlY.get() - (CRAWL_PIXELS_PER_SECOND * speed * delta) / 1000;
    if (nextY <= crawlBounds.end) {
      crawlY.set(crawlBounds.end);
      setIsComplete(true);
      return;
    }
    crawlY.set(nextY);
  });

  const replayThesis = () => {
    if (PREFERS_REDUCED_MOTION) return; // static transcript has no replay
    setIsComplete(false);
    setIntroStep(0);
    setIsPlaying(true);
    setSpeed(1);
    crawlY.set(crawlBounds.start);
    setSequenceVersion((version) => version + 1);
    // Restart the looping soundtrack with the replay unless the visitor muted it.
    stopAudio();
    if (!audioOptedOutRef.current) {
      void startAudio();
    }
  };

  // The thesis finished scrolling: fade the soundtrack out gracefully and
  // release it, ending the experience in silence.
  useEffect(() => {
    if (!isComplete) return;
    fadeOutSoundtrack(SOUNDTRACK_COMPLETION_FADE_MS, () => stopAudio());
    // fadeOutSoundtrack/stopAudio read only refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  // Generate star field via state lazy initializer to avoid useEffect call during render
  const [stars] = useState<Array<{ x: number; y: number; size: number; opacity: number; duration: number; blur: number; color: string }>>(() => {
    const starColors = ['#ffffff', '#dbeafe', '#fff7ed', '#fef3c7'];
    return Array.from({ length: 180 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.2 + 0.35,
      opacity: Math.random() * 0.72 + 0.18,
      duration: Math.random() * 5 + 3,
      blur: Math.random() > 0.82 ? Math.random() * 1.2 + 0.3 : 0,
      color: starColors[Math.floor(Math.random() * starColors.length)],
    }));
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="indii founder thesis"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black overflow-hidden flex flex-col items-center justify-center font-serif select-none"
        >
          {/* Star Field Background */}
          <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_40%,rgba(30,41,59,0.32),transparent_48%),radial-gradient(ellipse_at_18%_72%,rgba(88,28,135,0.14),transparent_38%),radial-gradient(ellipse_at_82%_20%,rgba(14,116,144,0.1),transparent_34%)]">
            <div className="absolute left-[-15%] top-[34%] h-[22%] w-[130%] -rotate-12 bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.04),rgba(255,255,255,0.09),rgba(148,163,184,0.035),transparent)] blur-[70px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.82)_100%)]" />
            {stars.map((star, i) => (
              <div
                key={i}
                className="absolute rounded-full animate-pulse"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  backgroundColor: star.color,
                  opacity: star.opacity,
                  filter: `blur(${star.blur}px)`,
                  boxShadow: star.size > 1.8 ? `0 0 ${star.size * 4}px ${star.color}` : 'none',
                  animationDuration: `${star.duration}s`,
                }}
              />
            ))}

            {/* The Viewer's Star (Gets closer and closer during the crawl) */}
            {introStep === 2 && !PREFERS_REDUCED_MOTION && (
              <motion.div
                initial={{ scale: 0.2, opacity: 0.1, x: '-50%', y: '-50%' }}
                animate={isPlaying ? {
                  scale: [1, 2.5, 8, 30, 95],
                  opacity: [0.2, 0.5, 0.8, 1, 0], // Fades out as it passes camera / completes
                  boxShadow: [
                    '0 0 4px rgba(245,158,11,0.2)',
                    '0 0 16px rgba(245,158,11,0.5)',
                    '0 0 40px rgba(245,158,11,0.7)',
                    '0 0 80px rgba(245,158,11,0.9)',
                    '0 0 120px rgba(245,158,11,0)'
                  ]
                } : {}}
                transition={{
                  duration: 220 / speed,
                  ease: 'easeIn',
                  repeat: Infinity
                }}
                className="absolute left-[50%] top-[45%] rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 z-10 pointer-events-none"
                style={{
                  width: '4px',
                  height: '4px',
                }}
              />
            )}
          </div>

          {/* Glowing Ambient Backdrop */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full bg-gradient-to-br from-amber-500/5 to-purple-500/5 blur-[150px] pointer-events-none" />

          {/* Quick HUD controls */}
          <div className="absolute top-6 left-6 right-6 z-50 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-3">
              <button
                ref={audioButtonRef}
                onClick={toggleAudio}
                aria-label={audioEnabled ? 'Mute thesis soundtrack' : 'Enable thesis soundtrack'}
                aria-pressed={audioEnabled}
                className="w-10 h-10 rounded-full border border-white/10 hover:border-amber-500/40 bg-black/40 hover:bg-black/80 flex items-center justify-center text-gray-400 hover:text-amber-400 transition-all backdrop-blur-md"
                title="Toggle thesis soundtrack"
              >
                {audioEnabled ? <Volume2 size={16} className="text-amber-400 animate-pulse" /> : <VolumeX size={16} />}
              </button>

              <a
                href={THESIS_PDF_PATH}
                download={THESIS_PDF_FILENAME}
                aria-label="Download the indii thesis as a PDF"
                className="flex h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-gray-400 backdrop-blur-md transition-all hover:border-amber-500/40 hover:bg-black/80 hover:text-amber-400 sm:px-4"
              >
                <Download size={15} />
                <span className="hidden sm:inline">Download PDF</span>
              </a>
              
              {introStep === 2 && !isComplete && !PREFERS_REDUCED_MOTION && (
                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full p-1 backdrop-blur-md">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    aria-label={isPlaying ? 'Pause thesis' : 'Play thesis'}
                    aria-pressed={!isPlaying}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <div className="flex items-center gap-1 rounded-full bg-black/30 border border-white/5 px-1">
                    <button
                      onClick={() => setSpeed(SPEED_LADDER[Math.max(0, SPEED_LADDER.indexOf(speed) - 1)])}
                      disabled={speed <= SPEED_LADDER[0]}
                      aria-label="Go slower"
                      title="Slow the crawl"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronsDown size={13} />
                    </button>
                    <span
                      className={`px-1 text-[10px] font-mono font-bold tracking-wide ${
                        speed === 1 ? 'text-gray-400' : 'text-amber-400'
                      }`}
                      aria-live="polite"
                    >
                      {SPEED_LABELS[speed] ?? `${speed}x`}
                    </span>
                    <button
                      onClick={() => setSpeed(SPEED_LADDER[Math.min(SPEED_LADDER.length - 1, SPEED_LADDER.indexOf(speed) + 1)])}
                      disabled={speed >= SPEED_LADDER[SPEED_LADDER.length - 1]}
                      aria-label="Go faster"
                      title="Speed up the crawl"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronsUp size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              aria-label="Close thesis"
              className="group w-10 h-10 rounded-full border border-white/10 hover:border-amber-500/40 bg-black/40 hover:bg-black/80 flex items-center justify-center text-gray-400 hover:text-amber-400 transition-all backdrop-blur-md"
            >
              <X size={16} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>

          {/* Step 0: Star Wars style Blue Intro Text */}
          {introStep === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: INTRO_TEXT_MS / 1000 - 0.2, times: [0, 0.12, 0.84, 1] }}
              className="text-[#4bd5ee] text-2xl md:text-4xl lg:text-5xl text-left max-w-5xl px-12 leading-relaxed font-sans font-light tracking-wide z-10 space-y-8"
            >
              <p>In the not too distant future, independent music artists will become independent business owners.</p>
              <p>They will no longer submit to gatekeepers, sign away their masters, or lease their careers.</p>
              <p>This is the operating system for their musical independence...</p>
            </motion.div>
          )}

          {/* Step 1: Glowing indii logo flying outwards */}
          {introStep === 1 && (
            <motion.div
              initial={{ scale: 3.5, opacity: 0 }}
              animate={{ scale: 0.15, opacity: [0, 1, 1, 0] }}
              transition={{ duration: LOGO_REVEAL_MS / 1000, times: [0, 0.15, 0.78, 1], ease: [0.85, 0, 0.15, 1] }}
              className="font-black text-7xl md:text-9xl lg:text-[12rem] text-amber-400 tracking-widest text-center select-none font-sans filter drop-shadow-[0_0_40px_rgba(245,158,11,0.6)] z-10"
            >
              <span className="indii-name">indii.music</span>
            </motion.div>
          )}

          {/* Step 2: Perspective Scroll Container */}
          {introStep === 2 && (
            <div className="relative w-full h-full flex flex-col justify-end items-center z-10">
              {/* Fade out mask at the top */}
              <div className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-black via-black/85 to-transparent z-20 pointer-events-none" />
              {/* Diffuser — softly blurs the text as it materializes into the top zone */}
              <div
                className="absolute top-0 left-0 right-0 h-[32%] backdrop-blur-[3px] z-20 pointer-events-none"
                style={{
                  WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
                  maskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
                }}
              />

              {/* 3D Perspective Area */}
              <div
                className="relative w-full max-w-[2400px] h-[92%] overflow-hidden"
                style={{
                  perspective: '1200px',
                  perspectiveOrigin: '50% 18%',
                }}
              >
                {/* Fixed projection plane keeps the crawl readable regardless of document length. */}
                <div
                  className="absolute inset-x-0 -bottom-[8%] h-[120%] flex flex-col items-center"
                  style={{
                    transform: 'rotateX(17deg)',
                    transformOrigin: '50% 100%',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Scrolling content */}
{PREFERS_REDUCED_MOTION ? (
                  // Vestibular-safe reading mode: static, scrollable transcript.
                  <div className="relative w-full h-full flex flex-col items-center justify-center z-10 px-5 md:px-12">
                    <div className="w-full max-w-4xl h-[80vh] overflow-y-auto rounded-2xl border border-white/15 bg-black/70 p-6 md:p-10 text-center text-amber-400 font-bold text-2xl leading-[1.55] md:text-4xl">
                      <ThesisContent />
                    </div>
                  </div>
                ) : (
                  <motion.div
                    ref={scrollContainerRef}
                    className="w-[88%] md:w-[76%] lg:w-[68%] max-w-6xl text-center text-amber-400 font-bold text-3xl md:text-5xl lg:text-6xl leading-[1.5] space-y-56 select-text pb-64"
                    style={{
                      y: crawlY,
                      textShadow: '0 2px 16px rgba(0,0,0,0.95), 0 0 20px rgba(245,158,11,0.16)',
                    }}
                  >
                    <ThesisContent />
                  </motion.div>
                )}
                </div>
              </div>

              {/* Sound prompt instruction banner for better UX */}
              {!audioEnabled && (
                <button
                  type="button"
                  onClick={enableAudio}
                  className="absolute bottom-10 left-6 z-30 bg-amber-500/10 border border-amber-500/30 rounded-full px-6 py-2 backdrop-blur-md flex items-center gap-2 cursor-pointer hover:bg-amber-500/20 transition-all shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                >
                  <Info size={14} className="text-amber-400" />
                  <span className="text-amber-400 font-mono text-[10px] font-bold tracking-widest uppercase">Enable thesis soundtrack</span>
                </button>
              )}

              <AnimatePresence>
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.2, delay: 2.4 }}
                    className="absolute inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.09),rgba(0,0,0,0.78)_48%,#000_82%)] px-6"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 28 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 1.1, delay: 3.2, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full max-w-5xl text-center"
                    >
                      <div className="font-mono text-[10px] uppercase tracking-[0.38em] text-amber-400/75">
                        Message received
                      </div>
                      <h2 className="mt-8 text-5xl font-black leading-[0.88] tracking-[-0.055em] text-white md:text-8xl lg:text-[8rem]">
                        Build your career
                        <span className="block text-amber-400">without giving it away.</span>
                      </h2>
                      <div className="mx-auto mt-9 flex w-fit items-center gap-3 text-sm font-semibold text-white/65">
                        <span className="h-px w-9 bg-amber-400" />
                        <span className="wiil-name">wiil</span>, Founder
                      </div>

                      <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <a
                          href={getStudioUrl()}
                          rel="noopener noreferrer"
                          className="group inline-flex w-full items-center justify-center gap-3 rounded-full bg-amber-400 px-8 py-4 text-sm font-black text-black shadow-[0_0_38px_rgba(245,158,11,0.32)] transition-transform hover:scale-[1.03] sm:w-auto"
                        >
                          Get Founding Owner access — $2,500
                          <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                        </a>
                        {!PREFERS_REDUCED_MOTION && (
                          <button
                            type="button"
                            onClick={replayThesis}
                            className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-white/15 px-8 py-4 text-sm font-bold text-white/70 transition-colors hover:border-amber-400/45 hover:text-white sm:w-auto"
                          >
                            <RotateCcw size={14} />
                            Replay the thesis
                          </button>
                        )}
                      </div>
                      <p className="mx-auto mt-5 max-w-md font-mono text-[9px] uppercase leading-relaxed tracking-[0.16em] text-white/40">
                        The Founding Owner License is a software purchase, not an investment or promise of financial return.
                      </p>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
