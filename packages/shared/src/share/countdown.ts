/**
 * Pure countdown decomposition helpers for release dates.
 *
 * Kept free of DOM/timers so it is deterministic across timezones, DST
 * boundaries, and server/client renderers.
 */

export interface CountdownParts {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isOut: boolean;
    accessibleLabel: string;
}

const OUT_NOW_LABEL = 'Out now';
const UNAVAILABLE_LABEL = 'Release date unavailable';

function parseTargetTimestamp(releaseDate: string | number): number | null {
    if (typeof releaseDate === 'number') {
        return Number.isFinite(releaseDate) ? releaseDate : null;
    }
    const trimmed = releaseDate.trim();
    if (!trimmed) return null;

    const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dayOnly) {
        const year = Number(dayOnly[1]);
        const month = Number(dayOnly[2]);
        const day = Number(dayOnly[3]);
        // Parse YYYY-MM-DD as local calendar midnight so negative UTC offsets
        // do not shift the release day backward, and reject calendar rollovers.
        const date = new Date(year, month - 1, day);
        if (
            Number.isNaN(date.getTime())
            || date.getFullYear() !== year
            || date.getMonth() !== month - 1
            || date.getDate() !== day
        ) {
            return null;
        }
        return date.getTime();
    }

    const parsed = new Date(trimmed);
    const ms = parsed.getTime();
    return Number.isNaN(ms) ? null : ms;
}

function pluralize(value: number, unit: string): string {
    return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

/**
 * Decomposes a release timestamp into remaining days, hours, minutes, seconds,
 * release status, and a screen-reader-friendly summary string.
 */
export function countdownParts(releaseDate: string | number, now: Date = new Date()): CountdownParts {
    const targetMs = parseTargetTimestamp(releaseDate);
    if (targetMs === null) {
        return {
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            isOut: true,
            accessibleLabel: UNAVAILABLE_LABEL,
        };
    }

    const nowMs = Number.isNaN(now.getTime()) ? Date.now() : now.getTime();
    const diffMs = targetMs - nowMs;
    if (diffMs <= 0) {
        return {
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            isOut: true,
            accessibleLabel: OUT_NOW_LABEL,
        };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86_400);
    const hours = Math.floor((totalSeconds % 86_400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(pluralize(days, 'day'));
    if (hours > 0 || parts.length > 0) parts.push(pluralize(hours, 'hour'));
    if (minutes > 0 || parts.length > 0) parts.push(pluralize(minutes, 'minute'));
    parts.push(pluralize(seconds, 'second'));

    return {
        days,
        hours,
        minutes,
        seconds,
        isOut: false,
        accessibleLabel: `${parts.join(', ')} until release`,
    };
}
