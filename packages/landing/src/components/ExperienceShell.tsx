'use client';

import React from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * ExperienceShell — mounts ambient dark studio motion video background.
 * Lightweight, GPU-accelerated, muted, disabled on reduced motion.
 */
export default function ExperienceShell() {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-20 mix-blend-screen"
      aria-hidden="true"
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="h-full w-full object-cover"
        src="/videos/ambient-studio-loop.mp4"
      />
    </div>
  );
}
