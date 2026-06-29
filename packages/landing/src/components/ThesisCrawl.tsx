'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, X, Play, Pause, Info } from 'lucide-react';

interface ThesisCrawlProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThesisCrawl({ isOpen, onClose }: ThesisCrawlProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1); // 1 = normal, 2 = fast, 4 = warp
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [introStep, setIntroStep] = useState(0); // 0: blue text, 1: logo, 2: crawl
  const audioContextRef = useRef<AudioContext | null>(null);
  const synthNodesRef = useRef<any[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Audio Synth logic for Star Wars style retro dramatic music (Detroit Synth vibe)
  const startAudio = () => {
    try {
      if (audioContextRef.current) return;
      
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;
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

  const stopAudio = () => {
    synthNodesRef.current.forEach(osc => {
      try {
        osc.stop();
      } catch (_e) {
        // Safe to ignore if oscillator was already stopped
      }
    });
    synthNodesRef.current = [];
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioEnabled(false);
  };

  const toggleAudio = () => {
    if (audioEnabled) {
      stopAudio();
    } else {
      startAudio();
    }
  };

  // Adjust state during render based on props to avoid useEffect setState warning
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setIntroStep(0);
      setIsPlaying(true);
      setSpeed(1);
    }
  }

  // Lock scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      // Auto-advance intro steps
      const introTimer1 = setTimeout(() => setIntroStep(1), 8800);
      const introTimer2 = setTimeout(() => setIntroStep(2), 15300);
      
      return () => {
        clearTimeout(introTimer1);
        clearTimeout(introTimer2);
      };
    } else {
      document.body.style.overflow = 'unset';
      setTimeout(stopAudio, 0);
    }
  }, [isOpen]);

  // Generate star field via state lazy initializer to avoid useEffect call during render
  const [stars] = useState<Array<{ x: number; y: number; size: number; opacity: number; duration: number }>>(() => {
    return Array.from({ length: 100 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
      duration: Math.random() * 3 + 2,
    }));
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black overflow-hidden flex flex-col items-center justify-center font-serif select-none"
        >
          {/* Star Field Background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            {stars.map((star, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white animate-pulse"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  opacity: star.opacity,
                  animationDuration: `${star.duration}s`
                }}
              />
            ))}

            {/* The Viewer's Star (Gets closer and closer during the crawl) */}
            {introStep === 2 && (
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
                onClick={toggleAudio}
                className="w-10 h-10 rounded-full border border-white/10 hover:border-amber-500/40 bg-black/40 hover:bg-black/80 flex items-center justify-center text-gray-400 hover:text-amber-400 transition-all backdrop-blur-md"
                title="Toggle Audio Synth"
              >
                {audioEnabled ? <Volume2 size={16} className="text-amber-400 animate-pulse" /> : <VolumeX size={16} />}
              </button>
              
              {introStep === 2 && (
                <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full p-1 backdrop-blur-md">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    onClick={() => setSpeed(speed === 1 ? 0.75 : speed === 0.75 ? 0.5 : 1)}
                    className={`px-3 py-1 text-[10px] font-mono font-bold rounded-full transition-all ${
                      speed < 1 
                        ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.3)]' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {speed === 1 ? '1.0x NORMAL' : speed === 0.75 ? '0.75x SLOW' : '0.5x SLOWEST'}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
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
              transition={{ duration: 8.5, times: [0, 0.15, 0.85, 1] }}
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
              transition={{ duration: 6.5, times: [0, 0.18, 0.8, 1], ease: [0.85, 0, 0.15, 1] }}
              className="font-black text-7xl md:text-9xl lg:text-[12rem] text-amber-400 tracking-widest text-center select-none font-sans filter drop-shadow-[0_0_40px_rgba(245,158,11,0.6)] z-10"
            >
              indii.music
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
                className="relative w-full max-w-[3200px] h-[90%] overflow-hidden flex flex-col justify-end items-center"
                style={{
                  perspective: '950px',
                  perspectiveOrigin: '50% 20%',
                }}
              >
                {/* Scrolling content */}
                <motion.div
                  ref={scrollContainerRef}
                  initial={{ y: '125%' }}
                  animate={isPlaying ? { y: '-220%' } : {}}
                  transition={{
                    duration: 600 / speed,
                    ease: 'linear',
                    repeat: Infinity
                  }}
                  className="w-[92%] lg:w-[88%] text-center text-amber-400 font-bold text-4xl md:text-6xl lg:text-[4.25rem] leading-[1.6] space-y-64 select-text pb-64"
                  style={{
                    transformOrigin: '50% 100%',
                    rotateX: '15deg',
                  }}
                >
                  {/* Thesis Title */}
                  <div className="space-y-10">
                    <h1 className="text-7xl md:text-9xl lg:text-[11rem] font-black font-sans uppercase tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 drop-shadow-[0_0_40px_rgba(245,158,11,0.5)]">
                      The indii Thesis
                    </h1>
                    <p className="text-amber-500/80 font-mono text-3xl md:text-4xl lg:text-5xl tracking-widest uppercase">
                      Episode I: Everything to Everybody
                    </p>
                    <p className="text-amber-500/50 font-mono text-xl md:text-3xl tracking-[0.25em] uppercase mt-8">
                      New Detroit Music LLC — June 2026
                    </p>
                  </div>

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
                      indii is the machine without the middleman.
                    </p>
                  </div>

                  {/* Chapter II */}
                  <div className="space-y-12 text-justify">
                    <h3 className="text-white font-sans font-black tracking-widest text-center text-5xl md:text-6xl lg:text-7xl mt-24 mb-16">
                      EPISODE II: WHAT INDII IS
                    </h3>
                    <p>
                      indii is an AI-native business platform for independent music artists. Not a DAW. Not a streaming service. It's the operating system for an entire music career.
                    </p>
                    <p>
                      Every department a major label has, indii has — staffed not by humans on payroll, but by specialized AI agents that work 24/7, cost nothing per interaction, and get smarter with every session.
                    </p>
                    <p>
                      Thirteen departments. One single app. Zero employees. Available to any independent artist, anywhere, for a fraction of what a single intern costs at a major label.
                    </p>
                  </div>

                  {/* Chapter III */}
                  <div className="space-y-12 text-justify">
                    <h3 className="text-white font-sans font-black tracking-widest text-center text-5xl md:text-6xl lg:text-7xl mt-24 mb-16">
                      EPISODE III: THE ARCHITECTURAL ADVANTAGE
                    </h3>
                    <p>
                      Most "AI music tools" bolt a chatbot onto a single feature. That's a toy. indii is architecturally different.
                    </p>
                    <p>
                      First, agent specialization with shared memory. When the Legal agent reviews a venue contract, the Road Manager already knows the load-in time. There are no silos.
                    </p>
                    <p>
                      Second, the three-layer architecture. Complexity is pushed down into deterministic code, not left to AI probabilistic reasoning. The AI orchestrates; the code executes.
                    </p>
                    <p>
                      Third, the mobile sensor array. Drop a pin, snap a receipt, record a voice memo — every input from the real world flows through Firebase into the desktop studio where 274+ tools process it automatically.
                    </p>
                  </div>

                  {/* Chapter IV */}
                  <div className="space-y-12 text-justify">
                    <h3 className="text-white font-sans font-black tracking-widest text-center text-5xl md:text-6xl lg:text-7xl mt-24 mb-16">
                      EPISODE IV: THE YAGNI PHILOSOPHY
                    </h3>
                    <p>
                      You Aren't Gonna Need It — until you do. indii doesn't build features speculatively. It builds infrastructure — tools, agents, state management, persistence, relay systems — and recombines them as artists need them.
                    </p>
                    <p>
                      With 274+ registered tools and 41 feature modules built, the combinatorial surface area is staggering. Most new features require zero new code — just a new prompt that teaches the agent how to chain existing tools together.
                    </p>
                    <p>
                      This means indii's feature velocity is non-linear. Each new piece of infrastructure multiplies the number of features that become possible through recombination.
                    </p>
                  </div>

                  {/* Chapter V */}
                  <div className="space-y-12 text-justify">
                    <h3 className="text-white font-sans font-black tracking-widest text-center text-5xl md:text-6xl lg:text-7xl mt-24 mb-16">
                      EPISODE V: THE COMPETITIVE MOAT
                    </h3>
                    <p>
                      Every competitor does one thing. DistroKid does distribution; Splice does creative; Chartmetric does analytics. None of them talk. The artist is the integration layer.
                    </p>
                    <p>
                      indii is the only platform where your album art informs your socials, your route informs your merch, your contract informs your royalties, and your setlist auto-queues for PRO submission.
                    </p>
                    <p className="italic text-center text-white font-bold my-16 leading-snug">
                      "The moat isn't any single feature. The moat is that everything knows about everything else."
                    </p>
                  </div>

                  {/* Chapter VI */}
                  <div className="space-y-12 text-justify pb-96">
                    <h3 className="text-white font-sans font-black tracking-widest text-center text-5xl md:text-6xl lg:text-7xl mt-24 mb-16">
                      EPISODE VI: THE NEW SUPERSTAR
                    </h3>
                    <p>
                      This makes a superstar out of the artist who has talent and nothing else. The bedroom producer in Detroit who makes incredible music but has never filed for an ISRC, planned a tour route, or calculated royalty splits.
                    </p>
                    <p>
                      They don't need to learn any of that. They just need to talk to indii.
                    </p>
                    <p className="text-white italic mt-32 text-center text-5xl md:text-7xl lg:text-8xl font-light leading-snug">
                      "Think of it this way: this app is going to make somebody a superstar."
                    </p>
                    <p className="text-amber-500/60 text-center font-sans font-bold text-3xl tracking-widest uppercase mt-12 mb-32">
                      — Founder, indii
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Sound prompt instruction banner for better UX */}
              {!audioEnabled && (
                <div className="absolute bottom-10 left-6 z-30 bg-amber-500/10 border border-amber-500/30 rounded-full px-6 py-2 backdrop-blur-md flex items-center gap-2 cursor-pointer hover:bg-amber-500/20 transition-all shadow-[0_0_20px_rgba(245,158,11,0.15)]" onClick={startAudio}>
                  <Info size={14} className="text-amber-400" />
                  <span className="text-amber-400 font-mono text-[10px] font-bold tracking-widest uppercase">Click to enable cosmic theme sound</span>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
