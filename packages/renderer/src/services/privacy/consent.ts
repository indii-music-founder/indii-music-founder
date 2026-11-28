/**
 * Consent preferences — the single source of truth for what optional data
 * collection the user allows on this device.
 *
 * Categories:
 *   - essential: always on (auth, core functionality)
 *   - errorTracking: Sentry error reporting and session replay
 *   - analytics / marketing: reserved; nothing collects these today. Any future
 *     integration must check `hasConsent()` before it starts.
 *   - doNotSell: the user's "Do Not Sell or Share" opt-out (CCPA). It forces
 *     analytics and marketing off and strips identifying contact details from
 *     error reports.
 */
import { logger } from '@/utils/logger';

export const CONSENT_STORAGE_KEY = 'indii_cookie_consent';
/** Fired on `window` after preferences are saved; `detail` is the saved preferences. */
export const CONSENT_CHANGED_EVENT = 'indii:consent-changed';

export interface ConsentPreferences {
    essential: boolean; // Always true, cannot be toggled
    analytics: boolean;
    errorTracking: boolean;
    marketing: boolean;
    doNotSell?: boolean;
    timestamp: string;
    version: number;
}

export type ConsentCategory = 'essential' | 'analytics' | 'errorTracking' | 'marketing';

export const DEFAULT_CONSENT_PREFERENCES: ConsentPreferences = {
    essential: true,
    analytics: false,
    errorTracking: false,
    marketing: false,
    timestamp: '',
    version: 1,
};

/** Read consent preferences. Returns null if the user has not chosen yet. */
export function getConsentPreferences(): ConsentPreferences | null {
    try {
        const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored) as ConsentPreferences;
        if (!parsed.version || parsed.version < 1) return null;
        return parsed;
    } catch {
        return null;
    }
}

/** True only when the user explicitly allowed the category (and has not opted out of it). */
export function hasConsent(category: ConsentCategory): boolean {
    const prefs = getConsentPreferences();
    if (!prefs) return false;
    if (prefs.doNotSell && (category === 'analytics' || category === 'marketing')) return false;
    return prefs[category] === true;
}

export function isDoNotSellEnabled(): boolean {
    return getConsentPreferences()?.doNotSell === true;
}

/** Persist preferences on this device and notify listeners. Returns what was saved. */
export function saveConsentPreferences(prefs: ConsentPreferences): ConsentPreferences {
    // Callers that do not mention the opt-out (e.g. the cookie banner) keep the existing choice.
    const doNotSell = prefs.doNotSell ?? getConsentPreferences()?.doNotSell ?? false;
    const saved: ConsentPreferences = {
        ...prefs,
        doNotSell,
        essential: true,
        analytics: doNotSell ? false : prefs.analytics,
        marketing: doNotSell ? false : prefs.marketing,
        timestamp: new Date().toISOString(),
    };
    try {
        localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(saved));
    } catch (error: unknown) {
        logger.error('[Consent] Failed to save preferences', error);
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent<ConsentPreferences>(CONSENT_CHANGED_EVENT, { detail: saved }));
    }
    return saved;
}

/** Update a subset of preferences, starting from the current (or default) choice. */
export function updateConsentPreferences(patch: Partial<Omit<ConsentPreferences, 'timestamp' | 'version' | 'essential'>>): ConsentPreferences {
    return saveConsentPreferences({ ...(getConsentPreferences() ?? DEFAULT_CONSENT_PREFERENCES), ...patch });
}
