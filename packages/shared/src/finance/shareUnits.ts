/**
 * Fixed-point share arithmetic — the single source of truth for royalty and
 * split percentage math (Post-Mastering Administrative Engine, P1).
 *
 * Percentages are STORED as human-facing floats (0–100), but every comparison,
 * summation, gate, and payout conversion MUST go through these basis-point
 * share units. This mirrors the authoritative finance cloud function
 * (`calculateRoyaltyAllocations.ts`: `SHARE_UNITS_PER_PERCENT = 10_000`).
 *
 * NEVER compare a raw float percentage sum to 100 — `0.1 + 0.2 !== 0.3` drift
 * has already caused tolerance-band bugs in release/signature paths. All such
 * sites must resolve exactly through this module.
 */

/** Share units per 1.00% (basis points of the whole). */
export const SHARE_UNITS_PER_PERCENT = 10_000;

/** Share units representing exactly 100.00% (the whole). */
export const TOTAL_SHARE_UNITS = 100 * SHARE_UNITS_PER_PERCENT;

/**
 * Convert a human-facing percentage (0–100) to exact basis-point share units.
 * Returns NaN for non-finite input so callers fail closed on corrupt data.
 */
export function toShareUnits(percentage: number): number {
  if (!Number.isFinite(percentage)) return Number.NaN;
  return Math.round(percentage * SHARE_UNITS_PER_PERCENT);
}

/**
 * Exact integer sum of percentages in share units (no float drift).
 * Returns NaN if any entry is non-finite — sums must never silently pass.
 */
export function sumShareUnits(percentages: readonly number[]): number {
  let total = 0;
  for (const percentage of percentages) {
    const units = toShareUnits(percentage);
    if (!Number.isFinite(units)) return Number.NaN;
    total += units;
  }
  return total;
}

/**
 * True ONLY when the given percentages resolve to exactly 100.00% in
 * basis-point units. This is the contract every split gate must enforce —
 * "close enough" (tolerance bands) is rejected by design.
 */
export function splitsResolveExactly(percentages: readonly number[]): boolean {
  return sumShareUnits(percentages) === TOTAL_SHARE_UNITS;
}

/**
 * Human-facing percentage for a share-unit amount (inverse of toShareUnits).
 * Exact for values produced by toShareUnits; a single deterministic divide.
 */
export function shareUnitsToPercent(units: number): number {
  if (!Number.isFinite(units)) return Number.NaN;
  return units / SHARE_UNITS_PER_PERCENT;
}
