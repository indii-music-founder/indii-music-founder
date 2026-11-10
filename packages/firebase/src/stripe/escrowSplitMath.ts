/** Every payout share must be positive and the entire amount must be allocated. */
export function isCompleteSplit(percentages: number[]): boolean {
    return percentages.length > 0 && percentages.every(value => Number.isFinite(value) && value > 0) &&
        Math.abs(percentages.reduce((sum, value) => sum + value, 0) - 100) <= 1e-8;
}
