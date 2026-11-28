import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CONSENT_CHANGED_EVENT,
    DEFAULT_CONSENT_PREFERENCES,
    getConsentPreferences,
    hasConsent,
    isDoNotSellEnabled,
    saveConsentPreferences,
    updateConsentPreferences,
} from '@/services/privacy/consent';

describe('consent preferences', () => {
    beforeEach(() => localStorage.clear());

    it('grants nothing before the user chooses', () => {
        expect(getConsentPreferences()).toBeNull();
        expect(hasConsent('errorTracking')).toBe(false);
    });

    it('forces analytics and marketing off while Do Not Sell is on', () => {
        saveConsentPreferences({ ...DEFAULT_CONSENT_PREFERENCES, analytics: true, marketing: true, errorTracking: true, doNotSell: true });

        expect(getConsentPreferences()).toMatchObject({ analytics: false, marketing: false, errorTracking: true, doNotSell: true });
        expect(hasConsent('analytics')).toBe(false);
        expect(hasConsent('errorTracking')).toBe(true);
    });

    it('keeps an existing opt-out when a caller (the cookie banner) does not mention it', () => {
        updateConsentPreferences({ doNotSell: true });
        saveConsentPreferences({ essential: true, analytics: true, errorTracking: true, marketing: true, timestamp: '', version: 1 });

        expect(isDoNotSellEnabled()).toBe(true);
        expect(hasConsent('marketing')).toBe(false);
    });

    it('notifies listeners with the saved preferences', () => {
        const listener = vi.fn();
        window.addEventListener(CONSENT_CHANGED_EVENT, listener);
        updateConsentPreferences({ errorTracking: true });
        window.removeEventListener(CONSENT_CHANGED_EVENT, listener);

        expect(listener).toHaveBeenCalledTimes(1);
        expect((listener.mock.calls[0][0] as CustomEvent).detail).toMatchObject({ errorTracking: true, essential: true });
    });
});
