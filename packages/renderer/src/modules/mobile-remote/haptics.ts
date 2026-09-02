/**
 * Haptic feedback utility for mobile remote interfaces.
 */
export const triggerHaptic = (pattern: number | number[] = 50): void => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};
