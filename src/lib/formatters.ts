/**
 * Item 315: Locale-Aware Formatters
 *
 * Centralized formatting utilities using the Intl API.
 * Replace all raw toFixed(), manual date formatting, and
 * hardcoded currency symbols with these functions.
 *
 * All formatters detect the user's locale from the browser
 * and fall back to 'en-US' if unavailable.
 */

/**
 * Get the user's preferred locale from the browser.
 */
function getUserLocale(): string {
    if (typeof navigator !== 'undefined' && navigator.language) {
        return navigator.language;
    }
    return 'en-US';
}

// ─── Number Formatting ──────────────────────────────────────────────────────

/**
 * Format a number with locale-aware thousand separators and decimal places.
 *
 * @example formatNumber(1234567.89) → "1,234,567.89" (en-US)
 * @example formatNumber(1234567.89) → "1.234.567,89" (de-DE)
 */
export function formatNumber(
    value: number,
    options?: Intl.NumberFormatOptions
): string {
    return new Intl.NumberFormat(getUserLocale(), options).format(value);
}

/**
 * Format a number as a compact string (e.g., 1.2K, 3.4M).
 *
 * @example formatCompact(1234) → "1.2K"
 * @example formatCompact(5678901) → "5.7M"
 */
export function formatCompact(value: number): string {
    return new Intl.NumberFormat(getUserLocale(), {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

/**
 * Format a number as a percentage.
 *
 * @example formatPercent(0.156) → "15.6%"
 */
export function formatPercent(
    value: number,
    decimals = 1
): string {
    return new Intl.NumberFormat(getUserLocale(), {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

// ─── Currency Formatting ────────────────────────────────────────────────────

/**
 * Format a number as a currency value.
 *
 * @example formatCurrency(1234.56) → "$1,234.56" (en-US, USD)
 * @example formatCurrency(1234.56, 'EUR') → "€1,234.56" (en-US)
 * @example formatCurrency(1234.56, 'JPY') → "¥1,235" (en-US, no decimals)
 */
export function formatCurrency(
    value: number,
    currency = 'USD',
    options?: Partial<Intl.NumberFormatOptions>
): string {
    return new Intl.NumberFormat(getUserLocale(), {
        style: 'currency',
        currency,
        ...options,
    }).format(value);
}

/**
 * Format a currency value in compact notation.
 *
 * @example formatCurrencyCompact(1234567) → "$1.2M"
 */
export function formatCurrencyCompact(
    value: number,
    currency = 'USD'
): string {
    return new Intl.NumberFormat(getUserLocale(), {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

// ─── Date Formatting ────────────────────────────────────────────────────────

/**
 * Format a date in the user's locale.
 *
 * @example formatDate(new Date()) → "Mar 8, 2026" (en-US)
 * @example formatDate(new Date(), 'long') → "March 8, 2026" (en-US)
 */
export function formatDate(
    date: Date | number | string,
    style: 'short' | 'medium' | 'long' | 'full' = 'medium'
): string {
    const d = date instanceof Date ? date : new Date(date);

    const styleMap: Record<string, Intl.DateTimeFormatOptions> = {
        short: { month: 'numeric', day: 'numeric', year: '2-digit' },
        medium: { month: 'short', day: 'numeric', year: 'numeric' },
        long: { month: 'long', day: 'numeric', year: 'numeric' },
        full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
    };

    return new Intl.DateTimeFormat(getUserLocale(), styleMap[style]).format(d);
}

/**
 * Format a date with time.
 *
 * @example formatDateTime(new Date()) → "Mar 8, 2026, 11:35 AM" (en-US)
 */
export function formatDateTime(
    date: Date | number | string,
    options?: Intl.DateTimeFormatOptions
): string {
    const d = date instanceof Date ? date : new Date(date);

    return new Intl.DateTimeFormat(getUserLocale(), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        ...options,
    }).format(d);
}

/**
 * Format a relative time (e.g., "2 hours ago", "in 3 days").
 *
 * @example formatRelativeTime(Date.now() - 3600000) → "1 hour ago"
 */
export function formatRelativeTime(date: Date | number | string): string {
    const d = date instanceof Date ? date : new Date(date);
    const now = Date.now();
    const diffMs = d.getTime() - now;
    const absDiffMs = Math.abs(diffMs);

    const rtf = new Intl.RelativeTimeFormat(getUserLocale(), { numeric: 'auto' });

    if (absDiffMs < 60000) {
        return rtf.format(Math.round(diffMs / 1000), 'second');
    } else if (absDiffMs < 3600000) {
        return rtf.format(Math.round(diffMs / 60000), 'minute');
    } else if (absDiffMs < 86400000) {
        return rtf.format(Math.round(diffMs / 3600000), 'hour');
    } else if (absDiffMs < 2592000000) {
        return rtf.format(Math.round(diffMs / 86400000), 'day');
    } else if (absDiffMs < 31536000000) {
        return rtf.format(Math.round(diffMs / 2592000000), 'month');
    } else {
        return rtf.format(Math.round(diffMs / 31536000000), 'year');
    }
}

// ─── File Size Formatting ───────────────────────────────────────────────────

/**
 * Format bytes into a human-readable file size.
 *
 * @example formatFileSize(1536) → "1.5 KB"
 * @example formatFileSize(1073741824) → "1 GB"
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);

    return `${formatNumber(size, { maximumFractionDigits: i === 0 ? 0 : 1 })} ${units[i]}`;
}

// ─── Duration Formatting ────────────────────────────────────────────────────

/**
 * Format seconds into a human-readable duration.
 *
 * @example formatDuration(185) → "3:05"
 * @example formatDuration(3723) → "1:02:03"
 */
export function formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
