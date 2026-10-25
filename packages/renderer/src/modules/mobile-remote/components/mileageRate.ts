/** IRS optional business mileage rates; unknown future periods remain unavailable.
 * https://www.irs.gov/tax-professionals/standard-mileage-rates
 */
export function businessMileageRate(date: Date): number | null {
    const year = date.getFullYear();
    if (year !== 2026) return null;
    return date.getMonth() < 6 ? 0.725 : 0.76;
}
