/**
 * Motion rules for the Artist Passport event horizon.
 *
 * Pure functions so the choreography is testable without WebGL:
 * - the horizon brightens a little with every answered step (the assessment
 *   "feeds" it), stays calm enough to keep question text readable, and settles
 *   after the report resolves;
 * - every step change fires a short pulse that decays on its own — forward
 *   steps surge, going back is gentler, the report gets one larger flare.
 */

/** Last wizard step number (1..5 are questions, 6 is the report). */
export const REPORT_STEP = 6;

export function horizonIntensityForStep(step: number): number {
  if (step <= 0) return 1;
  if (step >= REPORT_STEP) return 0.34;
  return 0.2 + 0.055 * (step - 1);
}

/** Pulse strength (0 = none) to fire when moving from `prev` to `next`. */
export function pulseForStepChange(prev: number, next: number): number {
  if (next === prev) return 0;
  // Leaving the hero is the CTA's own plunge (`warping`); returning to it is a reset.
  if (prev === 0 || next === 0) return 0;
  if (next >= REPORT_STEP && prev < REPORT_STEP) return 1.6;
  return next > prev ? 1 : 0.5;
}

/**
 * Opacity of the backdrop photograph: present on the hero, a quiet presence
 * behind the questions and the report. Shared by the DOM <img> and the WebGL
 * image layer so the two always match.
 */
export function backdropOpacityForStep(step: number): number {
  return step <= 0 ? 0.55 : 0.18;
}

/** Exponential decay rate of a pulse, per second. */
export const PULSE_DECAY_PER_SECOND = 2.8;

export function decayPulse(pulse: number, dtSeconds: number): number {
  const next = pulse * Math.exp(-PULSE_DECAY_PER_SECOND * dtSeconds);
  return next < 0.002 ? 0 : next;
}
