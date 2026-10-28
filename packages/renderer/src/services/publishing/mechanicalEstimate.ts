/** 2026 US physical/permanent-download estimate only; not a license or streaming rate.
 * Source: https://www.ecfr.gov/current/title-37/chapter-III/subchapter-E/part-385/subpart-B/section-385.11
 * Minute fractions round UP before selecting the larger per-work/per-minute rate.
 */
export const MECHANICAL_RATE_YEAR = 2026;
export function estimateMechanicalFee(copies: number, durationSeconds: number, year: number) {
    if (year !== MECHANICAL_RATE_YEAR) throw new Error('Mechanical rates for this year require verification before estimating.');
    if (!Number.isSafeInteger(copies) || copies <= 0) throw new Error('Copies must be a positive whole number.');
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error('A positive track duration in seconds is required.');
    const billableMinutes = Math.ceil(durationSeconds / 60);
    // Integer ten-thousandths of USD preserve both statutory rate precisions.
    const rateUnits = Math.max(1310, billableMinutes * 252);
    const feeUnits = copies * rateUnits;
    if (!Number.isSafeInteger(rateUnits) || !Number.isSafeInteger(feeUnits) || !Number.isSafeInteger(feeUnits + 50)) {
        throw new Error('Mechanical estimate exceeds the supported numeric range.');
    }
    return { ratePerCopy: rateUnits / 10_000, totalFee: Math.floor((feeUnits + 50) / 100) / 100, billableMinutes };
}
