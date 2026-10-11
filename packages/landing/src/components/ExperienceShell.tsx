'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

const BACKGROUND_SCREENSHOTS = [
  '/screenshots/dashboard.png',
  '/screenshots/creative.png',
  '/screenshots/workflow.png',
  '/screenshots/canvas.png',
  '/screenshots/distribution.png',
  '/screenshots/analytics.png',
  '/screenshots/finance.png',
  '/screenshots/legal.png',
];

/**
 * ExperienceShell — mounts ambient dark studio screenshot carousel background.
 * Cycles gently across the latest high-resolution indii.music Retina captures with
 * smooth crossfading and subtle drift, eliminating all legacy indiiOS video references.
 */
export default function ExperienceShell() {
  const reducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % BACKGROUND_SCREENSHOTS.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-[0.16] mix-blend-screen"
      aria-hidden="true"
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="hidden"
        src="/videos/ambient-studio-loop.mp4"
      />
      <AnimatePresence initial={false}>
        <motion.img
          key={BACKGROUND_SCREENSHOTS[currentIndex]}
          src={BACKGROUND_SCREENSHOTS[currentIndex]}
          alt=""
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
          className="absolute inset-0 h-full w-full object-cover object-top filter contrast-[1.08] brightness-[0.88]"
        />
      </AnimatePresence>
      {/* Dark studio vignette gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,transparent_30%,#000000_90%)] pointer-events-none" />
    </div>
  );
}
