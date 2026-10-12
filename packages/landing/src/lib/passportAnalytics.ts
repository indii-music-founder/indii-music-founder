import type {
    PassportFunnelEventName,
    PassportFunnelEventDetails,
    PassportFunnelEventRecord,
} from '@indii/shared';

import { readCampaignAttribution } from './nowWhatCampaign';

const PASSPORT_SESSION_KEY = 'indii_passport_session_id';
const PASSPORT_EVENT_LOG_KEY = 'indii_passport_event_log';
const MAX_LOCAL_EVENTS = 50;

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
        fbq?: (...args: unknown[]) => void;
    }
}

export function getPassportSessionId(): string {
    if (typeof window === 'undefined') {
        return `pp-srv-${Date.now()}`;
    }

    try {
        const existing = window.sessionStorage.getItem(PASSPORT_SESSION_KEY);
        if (existing) return existing;

        const newId = `pp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        window.sessionStorage.setItem(PASSPORT_SESSION_KEY, newId);
        return newId;
    } catch {
        return `pp-fallback-${Date.now()}`;
    }
}

export function readPassportEventLog(): PassportFunnelEventRecord[] {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.sessionStorage.getItem(PASSPORT_EVENT_LOG_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function appendPassportEventLog(record: PassportFunnelEventRecord): void {
    if (typeof window === 'undefined') return;

    try {
        const history = readPassportEventLog();
        history.push(record);
        window.sessionStorage.setItem(
            PASSPORT_EVENT_LOG_KEY,
            JSON.stringify(history.slice(-MAX_LOCAL_EVENTS))
        );
    } catch {
        // Logging to sessionStorage is best-effort
    }
}

export function trackPassportEvent(
    eventName: PassportFunnelEventName,
    details: PassportFunnelEventDetails = {},
    assessmentId?: string | null
): PassportFunnelEventRecord {
    const sessionId = getPassportSessionId();
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/passport';
    const href = typeof window !== 'undefined' ? window.location.href : 'https://indii.music/passport';

    details = { ...readCampaignAttribution(typeof window !== 'undefined' ? window.location.search : ''), ...details };
    const record: PassportFunnelEventRecord = {
        eventName,
        path: pathname,
        url: href,
        sessionId,
        assessmentId: assessmentId ?? null,
        details,
        occurredAtMs: Date.now(),
    };

    appendPassportEventLog(record);

    // 1. Google Analytics (gtag)
    try {
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
            window.gtag('event', eventName, {
                event_category: 'artist_passport',
                event_label: assessmentId || undefined,
                session_id: sessionId,
                ...details,
            });
        }
    } catch {
        // Analytics emission is non-blocking
    }

    // 2. Meta Pixel (fbq)
    try {
        if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
            window.fbq('trackCustom', eventName, {
                ...details,
                assessmentId,
            });
        }
    } catch {
        // Analytics emission is non-blocking
    }

    return record;
}
