/**
 * Motion system tokens — one motion designer's vocabulary for the whole site.
 *
 * These are the easing curves and durations used across the experience.
 * Existing sections already animate with `[0.16, 1, 0.3, 1]` (expo-out) —
 * this file centralizes that language for new and refactored motion.
 */

export type CubicBezier = [number, number, number, number];

/** The house ease: fast start, long luxurious settle (expo-out). */
export const EASE_OUT_EXPO: CubicBezier = [0.16, 1, 0.3, 1];

/** Slightly softer settle for large editorial blocks. */
export const EASE_OUT_QUINT: CubicBezier = [0.22, 1, 0.36, 1];

/** Quick, tactile micro-interactions. */
export const EASE_OUT_CUBIC: CubicBezier = [0.33, 1, 0.68, 1];

export const DURATION = {
  /** Hover / tab switch / small fades. */
  fast: 0.35,
  /** Standard reveal. */
  base: 0.65,
  /** Big editorial reveals. */
  slow: 0.95,
  /** Hero word cascade. */
  hero: 1.1,
} as const;

export const VIEWPORT_MARGIN = '-100px' as const;
