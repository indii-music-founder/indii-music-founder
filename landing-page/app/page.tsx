'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
// import PulseButton from './components/ui/PulseButton';
// import BreathingText from './components/ui/BreathingText';
import AudioManager from './components/AudioManager';
import DigitalBillboard from './components/ui/DigitalBillboard';
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
      <AudioManager />
      <SoundscapeCanvas />

      {/* 2. Content Overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 w-full max-w-7xl mx-auto">

        {/* Glass Hero Card */}
        <motion.div
          className="relative w-full max-w-5xl min-h-[600px] flex flex-col items-center justify-center bg-white/[0.02] backdrop-blur-[30px] backdrop-saturate-150 border-t border-l border-white/20 border-b border-r border-black/20 rounded-[3rem] p-12 md:p-16 lg:p-24 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Internal Reflective Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20 pointer-events-none" />

          {/* Subtle Noise Texture for realism (Optional, simulates frosted glass grain) */}
          <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none" />

          <div className="relative z-20 space-y-10 text-center w-full">
            {/* Animated Badge / Logo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <span className="text-4xl md:text-5xl font-bold tracking-tight text-white/90 animate-pulse-slow">
                indiiOS
              </span>
            </motion.div>

            {loading ? (
              <div className="h-[400px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            ) : (
              <DigitalBillboard
                user={user}
                authenticatedCta={{ label: "Launch Studio", href: getStudioUrl() }}
              />
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

      {/* Footer / Anchors */}
      < motion.div
        className="absolute bottom-8 left-0 right-0 text-center text-white/20 text-sm tracking-widest uppercase"
        initial={{ opacity: 0 }
        }
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 2 }}
      >
        <p>Scroll to Resonate</p>
      </motion.div >

    </main >
  );
}
