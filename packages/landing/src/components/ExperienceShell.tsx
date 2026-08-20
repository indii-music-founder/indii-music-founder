'use client';

/**
 * ExperienceShell — mounts the WebGL system layer only when it is genuinely
 * useful, and hands back to the DOM background otherwise.
 *
 * FALLBACK (reduced motion, no WebGL2, low-end device): renders nothing — the
 * page's own starfield/grid/glow background carries the design, and all
 * content and conversion paths remain fully intact.
 *
 * Otherwise it renders the lazy-loaded SystemExperience with a soft fade-in
 * so the first paint is never blocked by WebGL initialization.
 */
import { useEffect, useState } from 'react';
import { detectQualityProfile, type QualityProfile, type QualityTier } from '../three/quality';
import SystemExperience from '../three/SystemExperience';

export default function ExperienceShell() {
  const [profile] = useState<QualityProfile>(() => detectQualityProfile());
  const [tier, setTier] = useState<QualityTier>(profile.tier);
  const [fallenBack, setFallenBack] = useState(false);

  // If the OS motion preference flips to "reduce" while the page is open,
  // tear the WebGL layer down rather than keep animating for the visitor.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setFallenBack(true);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (profile.tier === 'FALLBACK' || fallenBack) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="system-canvas-layer"
      data-quality-tier={tier}
    >
      <SystemExperience
        initialProfile={profile}
        onFallback={() => setFallenBack(true)}
        onTierChange={setTier}
      />
    </div>
  );
}
