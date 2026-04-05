/**
 * Item 315: Locale-Aware Number, Date & Currency Formatting
 *
 * Replaces all raw `toFixed()`, `new Date().toLocaleDateString()`, and
 * manual currency formatting with `Intl.NumberFormat` and `Intl.DateTimeFormat`.
 *
 * All helpers accept an optional `locale` parameter — defaults to the
 * user's browser locale so the app works correctly in non-English markets.
 *
 * Usage:
 *   formatCurrency(1234.5)            → "$1,235"
 *   formatCurrency(1234.5, 'de-DE')   → "1.235 €" (German)
 *   formatNumber(1234567.89)          → "1,234,567.89"
 *   formatPercent(0.875)              → "87.5%"
 *   formatDate(new Date())            → "March 17, 2026"
 *   formatDateTime(new Date())        → "March 17, 2026, 2:30 PM"
 *   formatRelativeTime(pastDate)      → "3 days ago"
 *   formatDuration(245)              → "4:05"
 */

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

/**
 * Format a number as currency. Defaults to USD for the user's locale.
 * Pass `currency` to change (e.g. 'EUR', 'GBP').
 */
export function formatCurrency(
    amount: number,
    locale?: string,
    currency = 'USD',
    options?: Intl.NumberFormatOptions
): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        ...options,
    }).format(amount);
}

/**
 * Format a compact currency value (e.g. $1.2K, $3.5M).
 */
export function formatCurrencyCompact(amount: number, locale?: string, currency = 'USD'): string {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(amount);
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * Format a plain number with locale-appropriate separators.
 */
export function formatNumber(
    value: number,
    locale?: string,
    options?: Intl.NumberFormatOptions
): string {
    return new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
        ...options,
    }).format(value);
}

/**
 * Format a number in compact notation (e.g. 1.2K, 4.5M).
 */
export function formatCompact(value: number, locale?: string): string {
    return new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

/**
 * Format a value as a percentage (0–1 → 0%–100%).
 */
export function formatPercent(value: number, locale?: string, decimalPlaces = 1): string {
    return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
    }).format(value);
}

/**
 * Format a BPM or plain integer — no decimal places.
 */
export function formatInt(value: number, locale?: string): string {
    return new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
    }).format(Math.round(value));
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * Format a date as a long human-readable string (e.g. "March 17, 2026").
 */
export function formatDate(
    date: Date | number | string,
    locale?: string,
    options?: Intl.DateTimeFormatOptions
): string {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options,
    }).format(d);
}

/**
 * Format a date as a short string (e.g. "Mar 17, 2026").
 */
export function formatDateShort(date: Date | number | string, locale?: string): string {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(d);
}

/**
 * Format a date + time (e.g. "March 17, 2026, 2:30 PM").
 */
export function formatDateTime(date: Date | number | string, locale?: string): string {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(d);
}

/**
 * Format a time only (e.g. "2:30 PM").
 */
export function formatTime(date: Date | number | string, locale?: string): string {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
    }).format(d);
}

// ---------------------------------------------------------------------------
// Relative Time
// ---------------------------------------------------------------------------

/**
 * Format a date relative to now (e.g. "3 days ago", "in 2 hours").
 * Uses `Intl.RelativeTimeFormat` for full locale support.
 */
export function formatRelativeTime(date: Date | number | string, locale?: string): string {
    const d = date instanceof Date ? date : new Date(date);
    const now = Date.now();
    const diffMs = d.getTime() - now;
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);
    const diffWeek = Math.round(diffDay / 7);
    const diffMonth = Math.round(diffDay / 30);
    const diffYear = Math.round(diffDay / 365);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
    if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
    if (Math.abs(diffDay) < 7) return rtf.format(diffDay, 'day');
    if (Math.abs(diffWeek) < 5) return rtf.format(diffWeek, 'week');
    if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'month');
    return rtf.format(diffYear, 'year');
}

// ---------------------------------------------------------------------------
// Audio / Music
// ---------------------------------------------------------------------------

/**
 * Format seconds into MM:SS (e.g. 245 → "4:05").
 */
export function formatDuration(seconds: number): string {
    const totalSec = Math.round(Math.abs(seconds));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Format a file size in human-readable form (e.g. "4.5 MB").
 */
export function formatFileSize(bytes: number, locale?: string): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
        return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
        return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
    }
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(bytes / (1024 * 1024 * 1024))} GB`;
}
