/**
 * Safe date string utilities.
 *
 * These helpers replace the common pattern `date.toISOString().split('T')[0]`
 * which returns `string | undefined` under `noUncheckedIndexedAccess`.
 *
 * Using `.substring()` with `.indexOf()` guarantees a `string` return type.
 */

/**
 * Extract the date portion (YYYY-MM-DD) from a Date object.
 *
 * @example
 * toDateString(new Date()) // "2026-03-17"
 */
export function toDateString(date: Date = new Date()): string {
    const iso = date.toISOString();
    return iso.substring(0, iso.indexOf('T'));
}

/**
 * Extract the date portion (YYYY-MM-DD) from an ISO date string.
 *
 * @example
 * extractDatePart("2026-03-17T10:30:00Z") // "2026-03-17"
 * extractDatePart("2026-03-17")           // "2026-03-17"  (no 'T' → returns as-is)
 */
export function extractDatePart(isoString: string): string {
    const tIndex = isoString.indexOf('T');
    return tIndex === -1 ? isoString : isoString.substring(0, tIndex);
}

/**
 * Safely split a string by the first occurrence of a delimiter and return the first part.
 * Unlike `str.split(delim)[0]`, this always returns `string` (never `undefined`).
 *
 * @example
 * splitFirst("image/png", "/")    // "image"
 * splitFirst("foo@bar.com", "@")  // "foo"
 * splitFirst("nodelim", "@")      // "nodelim" (no match → returns original)
 */
export function splitFirst(str: string, delimiter: string): string {
    const idx = str.indexOf(delimiter);
    return idx === -1 ? str : str.substring(0, idx);
}
