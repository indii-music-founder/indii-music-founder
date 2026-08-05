import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import {
    createFounderFunnelEventRecord,
    type FounderFunnelEventDetails,
    type FounderFunnelEventName,
} from '@indii/shared';

const QUEUE_KEY = 'indii_founder_funnel_queue';
const SESSION_KEY = 'indii_founder_funnel_session_id';
const MAX_QUEUED_EVENTS = 50;
let flushInFlight: Promise<void> | null = null;

function hasFounderContext() {
    if (typeof window === 'undefined') return false;
    const search = window.location?.search ?? '';
    const hostname = window.location?.hostname ?? '';

    try {
        return (
            search.includes('source=founder') ||
            hostname.startsWith('founder') ||
            window.localStorage.getItem('indii_founder_preview_pending') === 'true' ||
            window.localStorage.getItem('indii_founder_funnel_active') === 'true'
        );
    } catch {
        return (
            search.includes('source=founder') ||
            hostname.startsWith('founder')
        );
    }
}

function getSessionId() {
    if (typeof window === 'undefined') {
        return `ff-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    try {
        const stored = window.localStorage.getItem(SESSION_KEY);
        if (stored) return stored;
        const sessionId = `ff-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        window.localStorage.setItem(SESSION_KEY, sessionId);
        return sessionId;
    } catch {
        return `ff-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
}

function readQueue() {
    if (typeof window === 'undefined') return [];

    try {
        const raw = window.localStorage.getItem(QUEUE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as ReturnType<typeof createFounderFunnelEventRecord>[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeQueue(queue: ReturnType<typeof createFounderFunnelEventRecord>[]) {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED_EVENTS)));
    } catch {
        // Queue persistence is best-effort.
    }
}

async function flushQueue() {
    if (!db || typeof window === 'undefined') return;
    if (flushInFlight) {
        await flushInFlight;
        return;
    }

    flushInFlight = (async () => {
        const queue = readQueue();
        if (queue.length === 0) return;

        const remaining: ReturnType<typeof createFounderFunnelEventRecord>[] = [];
        for (const event of queue) {
            try {
                await addDoc(collection(db, 'founderFunnelEvents'), {
                    ...event,
                    createdAt: serverTimestamp(),
                });
            } catch {
                remaining.push(event);
            }
        }

        writeQueue(remaining);
    })().finally(() => {
        flushInFlight = null;
    });

    await flushInFlight;
}

export function flushFounderFunnelQueue() {
    void flushQueue();
}

export async function trackFounderFunnelEvent(
    eventName: FounderFunnelEventName,
    details: FounderFunnelEventDetails = {},
    actor?: { userId?: string | null; email?: string | null },
) {
    if (typeof window === 'undefined' || !hasFounderContext()) return;

    const record = createFounderFunnelEventRecord({
        eventName,
        path: window.location.pathname,
        url: window.location.href,
        sessionId: getSessionId(),
        source: 'founder',
        userId: actor?.userId ?? null,
        email: actor?.email ?? null,
        details,
    });

    try {
        const queue = readQueue();
        queue.push(record);
        writeQueue(queue);
    } catch {
        // Ignore queue persistence failures; tracking must not block UI.
    }

    try {
        const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
        if (gtag) {
            gtag('event', eventName, {
                event_category: 'founder_funnel',
                ...details,
            });
        }
    } catch {
        // No-op: analytics is best effort only.
    }

    await flushQueue();
}
