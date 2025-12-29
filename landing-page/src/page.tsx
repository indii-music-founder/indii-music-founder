'use client';

import { Suspense, lazy } from 'react';
// import Link from 'next/link'; // Not used in this file
import { motion, useScroll, useTransform } from 'framer-motion';
// import PulseButton from './components/ui/PulseButton';
// import BreathingText from './components/ui/BreathingText';
import AudioManager from './components/AudioManager';
import DigitalBillboard from './components/ui/DigitalBillboard';
import { useAuth } from './components/auth/AuthProvider';
import { getStudioUrl } from './lib/auth';

// Dynamically import 3D canvas to avoid SSR issues
const SoundscapeCanvas = lazy(() => import('./components/3d/SoundscapeCanvas'));

import FeatureShowcase from './components/FeatureShowcase';
import TechSpecs from './components/TechSpecs';

export default function Home() {
  const { user, loading } = useAuth();
  // 1. Scrollytelling Hook: Track scroll progress
  const { scrollYProgress } = useScroll();

  // 2. Parallax Transforms: Map scroll to movement
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]); // Background moves slower

  return (
    <main className="relative flex flex-col items-center justify-start min-h-screen overflow-hidden text-center selection:bg-resonance-blue selection:text-white">

      {/* 1. The Subliminal Background */}
      <AudioManager />
      <motion.div style={{ y: bgY }} className="absolute inset-0 z-0">
        <Suspense fallback={<div className="fixed inset-0 bg-void" />}>
          <SoundscapeCanvas />
        </Suspense>
      </motion.div>

      {/* 2. Content Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 w-full max-w-7xl mx-auto pt-20 pb-12">

        {/* Glass Hero Card with 2026 "Frosted" & "Human" Aesthetics */}
        <motion.div
          style={{ scale: heroScale, opacity: heroOpacity }}
          className="relative w-full max-w-6xl min-h-[700px] flex flex-col items-center justify-center glass-panel rounded-[3rem] p-12 md:p-24 overflow-hidden border border-glass-border mb-0"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} // smooth "Apple-style" ease
        >
          {/* Internal Reflective Gradient (Subtle Tech Bro shimmer) */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40 pointer-events-none" />

          {/* "Human Scribble" Accent (SVG) - 2026 Trend: Anti-AI Imperfection */}
          <div className="absolute top-10 right-10 w-32 h-32 opacity-80 pointer-events-none mix-blend-overlay human-scribble">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 50 Q 25 25, 50 10 T 90 50 Q 75 75, 50 90 T 10 50" stroke="var(--dopamine-pink)" strokeWidth="2" strokeLinecap="round" />
              <path d="M20 60 Q 35 35, 60 20 T 80 60" stroke="var(--electric-blue)" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 5" />
            </svg>
          </div>

          {/* Subtle Noise Texture for realism */}
          <div className="absolute inset-0 opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none" />

          <div className="relative z-20 space-y-12 text-center w-full max-w-4xl mx-auto">
            {/* Animated Badge / Logo with Kinetic Typography */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative"
            >
              {/* Oversized Headline (Trend: Exaggerated Hierarchy) */}
              <h1 className="text-7xl md:text-9xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-signal-white to-gray-400 animate-throb-light pb-4">
                indiiOS
              </h1>
              <p className="font-hand text-dopamine-pink text-2xl md:text-3xl absolute -right-4 -top-8 rotate-12 glow-text-pink">
                Beta v4.5
              </p>
            </motion.div>

            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                {/* Custom encoded SVG spinner or CSS loader would go here */}
                <div className="w-12 h-12 border-4 border-electric-blue border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="transform transition-transform hover:scale-[1.02] duration-500">
                <DigitalBillboard
                  user={user}
                  authenticatedCta={{ label: "Enter Studio", href: getStudioUrl() }}
                />
              </div>
            )}

            {/* Login Link below as a secondary action for all slides */}
            {!user && !loading && (
              <div className="mt-8">
                <a href={getStudioUrl()} className="text-gray-500 hover:text-white text-sm font-medium transition-colors">
                  Already have an account? Launch Studio
                </a>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* 3. New Sections */}
      <FeatureShowcase />
      <TechSpecs />

      {/* Footer / Anchors */}
      <motion.div
        className="w-full py-12 text-center text-white/20 text-sm tracking-widest uppercase border-t border-white/5"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <p>Engineered by indiiOS Inc. © 2026</p>
      </motion.div>

    </main>
  );
}
