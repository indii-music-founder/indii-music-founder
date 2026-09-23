/**
 * parseMoneyAmount — deterministic money-string parser for distributor statements.
 *
 * Distributor exports mix US ("1,234.56"), EU ("1.234,56"), and accounting
 * ("(0.50)") conventions. Naive digit-stripping silently corrupts magnitudes
 * (ISSUE-1443: "1.234,56" booked as 1.23; "(0.50)" booked as +0.50). This
 * parser makes the convention explicit and refuses (returns null) when the
 * value cannot be parsed — callers must quarantine null rows instead of
 * booking them.
 *
 * Rules ('auto'):
 *  - Accounting negatives: "(0.50)" → -0.50; leading "-" also accepted.
 *  - Currency symbols and whitespace are ignored.
 *  - Both "." and "," present → the RIGHTMOST one is the decimal separator;
 *    the other is a thousands separator.
 *  - Only "," present → decimal comma when followed by 1-2 digits
 *    ("12,50" → 12.5); otherwise treated as a thousands separator
 *    ("1,234" → 1234).
 *  - Only "." present → read as a decimal point ("1.234" → 1.234).
 *    (Per-value ambiguity for bare "1.234" is unavoidable without file-level
 *    context; a per-file format hint can be supplied via `format`.)
 *  - Anything unparseable → null. Callers quarantine.
 */
export type StatementMoneyFormat = 'us' | 'eu' | 'auto';

export function parseMoneyAmount(raw: string, format: StatementMoneyFormat = 'auto'): number | null {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim();
    if (s === '') return null;

    let negative = false;
    if (/^\(.*\)$/.test(s)) {
        negative = true;
        s = s.slice(1, -1).trim();
    }
    if (s.startsWith('-')) {
        s = s.slice(1).trim();
        negative = !negative;
    }
    if (s.startsWith('+')) s = s.slice(1).trim();

    // Strip currency symbols, spaces, and letters ("USD 1,234.56", "€1.234,56").
    s = s.replace(/[^0-9.,-]/g, '');
    if (s === '' || s === '-' || s === '.' || s === ',') return null;

    const hasDot = s.includes('.');
    const hasComma = s.includes(',');

    if (format === 'us') {
        s = s.replace(/,/g, '');
    } else if (format === 'eu') {
        s = s.replace(/\./g, '').replace(/,/g, '.');
    } else if (hasDot && hasComma) {
        // auto: rightmost separator is the decimal point.
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
    } else if (hasComma) {
        if (/,\d{1,2}$/.test(s)) {
            s = s.replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
    }

    const value = parseFloat(s);
    if (!Number.isFinite(value)) return null;
    return negative ? -value : value;
}
