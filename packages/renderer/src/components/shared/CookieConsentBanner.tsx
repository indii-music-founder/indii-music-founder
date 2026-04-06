import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cookie, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';

/**
 * Item 303: GDPR Cookie Consent Banner
 *
 * Shows an explicit consent banner on first visit. Gates Sentry and Firebase Analytics
 * initialization on user consent. Stores preference in localStorage.
 *
 * Consent categories:
 *   - essential: Always on (auth, core functionality)
 *   - analytics: Firebase Analytics, web-vitals
 *   - errorTracking: Sentry error reporting
 *   - marketing: Third-party marketing pixels (future)
 */

const CONSENT_STORAGE_KEY = 'indiiOS_cookie_consent';

export interface ConsentPreferences {
    essential: boolean; // Always true, cannot be toggled
    analytics: boolean;
    errorTracking: boolean;
    marketing: boolean;
    timestamp: string;
    version: number;
}

const DEFAULT_PREFERENCES: ConsentPreferences = {
    essential: true,
    analytics: false,
    errorTracking: false,
    marketing: false,
    timestamp: '',
    version: 1,
};

/**
 * Read consent preferences from localStorage.
 * Returns null if no consent has been given yet.
 */
export function getConsentPreferences(): ConsentPreferences | null {
    try {
        const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored) as ConsentPreferences;
        // Validate version
        if (!parsed.version || parsed.version < 1) return null;
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Check if a specific consent category has been granted.
 */
export function hasConsent(category: keyof Omit<ConsentPreferences, 'timestamp' | 'version'>): boolean {
    const prefs = getConsentPreferences();
    if (!prefs) return false;
    return prefs[category] === true;
}

/**
 * Save consent preferences to localStorage.
 */
function saveConsentPreferences(prefs: ConsentPreferences): void {
    try {
        localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({
            ...prefs,
            timestamp: new Date().toISOString(),
        }));
    } catch (error: unknown) {
        logger.error('[CookieConsent] Failed to save preferences', error);
    }
}

interface ConsentToggleProps {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

function ConsentToggle({ label, description, checked, onChange, disabled = false }: ConsentToggleProps) {
    return (
        <label className="flex items-start gap-3 cursor-pointer group py-2">
            <div className="pt-0.5">
                <button
                    role="switch"
                    type="button"
                    aria-checked={checked}
                    aria-label={`Toggle ${label}`}
                    disabled={disabled}
                    onClick={() => !disabled && onChange(!checked)}
                    className={cn(
                        'relative w-10 h-5 rounded-full transition-colors duration-200',
                        checked ? 'bg-purple-600' : 'bg-gray-600',
                        disabled && 'opacity-60 cursor-not-allowed'
                    )}
                >
                    <span
                        className={cn(
                            'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm',
                            checked ? 'translate-x-5' : 'translate-x-0.5'
                        )}
                    />
                </button>
            </div>
            <div className="flex-1">
                <span className="text-sm font-medium text-white block">
                    {label}
                    {disabled && <span className="text-xs text-gray-500 ml-2">(Required)</span>}
                </span>
                <span className="text-xs text-gray-400">{description}</span>
            </div>
        </label>
    );
}

export function CookieConsentBanner() {
    const [visible, setVisible] = useState(false);
    const [showCustomize, setShowCustomize] = useState(false);
    const [preferences, setPreferences] = useState<ConsentPreferences>({ ...DEFAULT_PREFERENCES });

    useEffect(() => {
        // Honor env var bypass (dev convenience/E2E tests)
        import('@/config/env').then(({ env }) => {
            if (env.skipOnboarding) {
                setVisible(false);
                return;
            }

            // Only show if no consent has been recorded
            const existing = getConsentPreferences();
            if (!existing) {
                // Small delay so it doesn't flash on initial load
                const timer = setTimeout(() => setVisible(true), 800);
                return () => clearTimeout(timer);
            }
        });
    }, []);

    const handleAcceptAll = useCallback(() => {
        const allConsent: ConsentPreferences = {
            essential: true,
            analytics: true,
            errorTracking: true,
            marketing: true,
            timestamp: '',
            version: 1,
        };
        saveConsentPreferences(allConsent);
        setVisible(false);

        // Initialize tracking services now that consent is given
        initializeConsentedServices(allConsent);
    }, []);

    const handleRejectNonEssential = useCallback(() => {
        const minimalConsent: ConsentPreferences = {
            essential: true,
            analytics: false,
            errorTracking: false,
            marketing: false,
            timestamp: '',
            version: 1,
        };
        saveConsentPreferences(minimalConsent);
        setVisible(false);
        logger.info('[CookieConsent] User rejected non-essential cookies.');
    }, []);

    const handleSaveCustom = useCallback(() => {
        saveConsentPreferences(preferences);
        setVisible(false);
        initializeConsentedServices(preferences);
    }, [preferences]);

    if (!visible) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-20 left-0 right-0 z-[200] p-4 md:p-6"
            >
                <div className="max-w-2xl mx-auto bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-5 pb-0">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-purple-500/10">
                                <Cookie className="w-5 h-5 text-purple-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-semibold text-white">Cookie Preferences</h3>
                                <p className="text-xs text-gray-400">We respect your privacy</p>
                            </div>
                            {/* Quick-dismiss: saves minimal (essential-only) consent */}
                            <button
                                onClick={handleRejectNonEssential}
                                aria-label="Reject non-essential cookies"
                                title="Reject non-essential cookies"
                                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            We use cookies and similar technologies to improve your experience,
                            analyze usage, and report errors. You can customize your preferences below.
                        </p>
                    </div>

                    {/* Customize Panel */}
                    <AnimatePresence>
                        {showCustomize && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="px-5 pt-4 space-y-1 border-t border-gray-700/50 mt-4">
                                    <ConsentToggle
                                        label="Essential"
                                        description="Authentication, navigation, and core app functionality."
                                        checked={true}
                                        onChange={() => { }}
                                        disabled
                                    />
                                    <ConsentToggle
                                        label="Analytics"
                                        description="Firebase Analytics and performance monitoring."
                                        checked={preferences.analytics}
                                        onChange={(v) => setPreferences(p => ({ ...p, analytics: v }))}
                                    />
                                    <ConsentToggle
                                        label="Error Tracking"
                                        description="Sentry error reporting to help us fix bugs."
                                        checked={preferences.errorTracking}
                                        onChange={(v) => setPreferences(p => ({ ...p, errorTracking: v }))}
                                    />
                                    <ConsentToggle
                                        label="Marketing"
                                        description="Third-party analytics and marketing pixels."
                                        checked={preferences.marketing}
                                        onChange={(v) => setPreferences(p => ({ ...p, marketing: v }))}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Actions */}
                    <div className="p-5 flex flex-col sm:flex-row items-center gap-3">
                        {showCustomize ? (
                            <>
                                <button
                                    onClick={() => setShowCustomize(false)}
                                    className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
                                >
                                    Back
                                </button>
                                <div className="flex-1" />
                                <button
                                    onClick={handleSaveCustom}
                                    className="px-6 py-2.5 text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors"
                                >
                                    Save Preferences
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleRejectNonEssential}
                                    className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition-colors order-3 sm:order-1"
                                >
                                    Reject Non-Essential
                                </button>
                                <button
                                    onClick={() => setShowCustomize(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded-xl transition-colors order-2"
                                >
                                    <Settings className="w-4 h-4" />
                                    Customize
                                </button>
                                <div className="flex-1 order-1 sm:order-3" />
                                <button
                                    onClick={handleAcceptAll}
                                    className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors order-1 sm:order-4"
                                >
                                    Accept All
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

/**
 * Initialize services that require consent.
 * Called after the user grants specific consent categories.
 */
function initializeConsentedServices(prefs: ConsentPreferences): void {
    if (prefs.errorTracking) {
        import('@/lib/sentry').then(({ initSentry }) => {
            initSentry();
            logger.info('[CookieConsent] Sentry initialized after consent.');
        }).catch(err => logger.error('[CookieConsent] Failed to init Sentry:', err));
    }

    if (prefs.analytics) {
        logger.info('[CookieConsent] Analytics consent granted. Ready for Firebase Analytics initialization.');
        // Firebase Analytics can be initialized here when added (Item 259)
    }
}
