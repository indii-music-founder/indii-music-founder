'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
import PulseButton from './components/ui/PulseButton';
import BreathingText from './components/ui/BreathingText';
import { useAuth } from './components/auth/AuthProvider';
import { getStudioUrl } from './lib/auth';

// Dynamically import 3D canvas to avoid SSR issues
const SoundscapeCanvas = dynamic(() => import('./components/3d/SoundscapeCanvas'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-void" />
});

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden text-center selection:bg-resonance-blue selection:text-white">

      {/* 1. The Subliminal Background */}
      <SoundscapeCanvas />

      {/* 2. Content Overlay */}
      <div className="relative z-10 max-w-5xl px-6 mx-auto space-y-12">

        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span className="inline-block px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] rounded-full bg-white/5 border border-white/10 text-white/70 animate-throb-light backdrop-blur-md">
            The Operating System for Independent Artists
          </span>
        </motion.div>

        {/* Hero Headline */}
        <motion.h1
          className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          Feel the <br />
          <BreathingText className="text-glow-blue inline-block">Music</BreathingText>
        </motion.h1>

        {/* Subheadline interacting with the "Pulse" concept */}
        <motion.p
          className="max-w-2xl mx-auto text-lg md:text-xl text-white/60 font-light leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
        >
          Experience the subliminal resonance of your creativity. <br />
          Tools that vibrate at the frequency of your imagination.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.2 }}
        >
          {loading ? (
            /* Loading State */
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : user ? (
            /* Logged In State */
            <Link href={getStudioUrl()}>
              <PulseButton className="text-lg px-12">
                Launch Studio
              </PulseButton>
            </Link>
          ) : (
            /* Guest State */
            <>
              <Link href="/auth/signup">
                <PulseButton className="text-lg">
                  Start Creating
                </PulseButton>
              </Link>

              <Link href="/auth/login">
                <PulseButton variant="secondary" className="text-lg">
                  Sign In
                </PulseButton>
              </Link>
            </>
          )}
        </motion.div>

      </div>

      {/* Footer / Anchors */}
      <motion.div
        className="absolute bottom-8 left-0 right-0 text-center text-white/20 text-sm tracking-widest uppercase"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 2 }}
      >
        <p>Scroll to Resonate</p>
      </motion.div>

    </main>
  );
}
