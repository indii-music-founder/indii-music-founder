import { useEffect, useRef, useState } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { Play, X } from 'lucide-react';

import { env } from '@/config/env';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { getConsentPreferences } from './CookieConsentBanner';
import { trackFounderFunnelEvent } from '@/services/founders/founderFunnel';

/**
 * Item 290: Contextual First-Run Tour
 *
 * Uses driver.js to highlight key UI affordances for first-time users:
 *   1. Command Bar (⌘K) — universal search and action launcher
 *   2. Module switcher (sidebar) — navigate between 20+ departments
 *   3. Intelligence Chat panel — floating agent for intelligent assistance
 *   4. Quick actions — context-sensitive right panel
 *
 * Tour is shown once per browser profile, stored in localStorage under
 * `indii_tour_completed_v1`. Skipping also sets the flag.
 *
 * Usage:
 *   Mount <FirstRunTour /> once in App.tsx after the main layout renders.
 *   It self-manages its own lifecycle.
 */

const TOUR_KEY = 'indii_tour_completed_v1';

export function FirstRunTour() {
    const driverRef = useRef<Driver | null>(null);
    const [tourCompleted, setTourCompleted] = useState(() => {
        if (typeof window === 'undefined') return true;
        return localStorage.getItem(TOUR_KEY) === 'true';
    });

    const { isEntryAssistantDismissed } = useStore(
        useShallow((s) => ({
            isEntryAssistantDismissed: s.isEntryAssistantDismissed,
        }))
    );

    const [cookieConsentResolved, setCookieConsentResolved] = useState(() => {
        if (typeof window === 'undefined') return true;
        return getConsentPreferences() !== null;
    });

    // Check cookie consent resolve status
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const checkConsent = () => {
            setCookieConsentResolved(getConsentPreferences() !== null);
        };
        window.addEventListener('storage', checkConsent);
        const interval = setInterval(checkConsent, 1000);
        return () => {
            window.removeEventListener('storage', checkConsent);
            clearInterval(interval);
        };
    }, []);

    const startTour = () => {
        if (typeof window === 'undefined') return;
        // Don't show during onboarding flow or if onboarding is bypassed via env
        if (env.skipOnboarding || window.location.hash.includes('onboarding')) return;

        void trackFounderFunnelEvent('founder_tour_started');

        const d = driver({
            showProgress: true,
            animate: true,
            smoothScroll: true,
            overlayColor: 'rgba(0, 0, 0, 0.75)',
            stagePadding: 6,
            stageRadius: 10,
            popoverClass: 'indii-tour-popover',
            nextBtnText: 'Next →',
            prevBtnText: '← Back',
            doneBtnText: 'Get Started',
            onDestroyStarted: () => {
                localStorage.setItem(TOUR_KEY, 'true');
                setTourCompleted(true);
                void trackFounderFunnelEvent('founder_tour_completed');
                d.destroy();
            },
            steps: [
                {
                    // Step 1: Sidebar
                    element: '[data-testid="nav-item-dashboard"], nav[aria-label="Main navigation"]',
                    popover: {
                        title: 'Your Creative OS',
                        description:
                            'indii.music is your all-in-one platform. Use the sidebar to navigate between 20+ departments — Creative, Distribution, Finance, Marketing, Legal, and more.',
                        side: 'right',
                        align: 'start',
                    },
                },
                {
                    // Step 2: Command Bar trigger
                    element: '[data-testid="command-bar"], [aria-label*="command" i], [aria-label*="search" i]',
                    popover: {
                        title: 'Command Bar (⌘K)',
                        description:
                            'Press ⌘K (or Ctrl+K) to open the Command Bar — your universal launcher for actions, search, and intelligence tasks across every module.',
                        side: 'bottom',
                        align: 'center',
                    },
                },
                {
                    // Step 3: Autonomous Chat / Agent panel
                    element: '[data-testid="chat-toggle"], [aria-label*="agent" i], [aria-label*="AI" i], [aria-label*="chat" i]',
                    popover: {
                        title: 'Intelligence Agent',
                        description:
                            'Your intelligence assistant is always one click away. Ask it to generate campaign briefs, review contracts, write lyrics, plan tours, or take any action across the platform.',
                        side: 'left',
                        align: 'center',
                    },
                },
                {
                    // Step 4: Right panel
                    element: '[data-testid="right-panel"], [aria-label*="panel" i]',
                    popover: {
                        title: 'Smart Context Panel',
                        description:
                            'The right panel adapts to whatever you\'re working on — showing agent responses, notifications, activity feed, and contextual quick actions.',
                        side: 'left',
                        align: 'center',
                    },
                },
                {
                    // Step 5: Boardroom (final step)
                    element: '[data-testid="nav-item-boardroom"], button:has-text("Boardroom")',
                    popover: {
                        title: 'Meet Your Boardroom',
                        description:
                            'Say hello to your team. Ask the Boardroom what indii is, what it can do, and how the agents work together. The Boardroom is your virtual conference room with all your specialists.',
                        side: 'right',
                        align: 'start',
                    },
                },
            ],
        });

        driverRef.current = d;

        // Only start if at least one element is found in the DOM
        const firstEl = document.querySelector(
            '[data-testid="nav-item-dashboard"], nav[aria-label="Main navigation"]'
        );
        if (firstEl) {
            d.drive();
        } else {
            // Elements not mounted yet — skip tour silently
            localStorage.setItem(TOUR_KEY, 'true');
            setTourCompleted(true);
        }
    };

    const trackedIntroClosed = useRef(false);

    useEffect(() => {
        if (isEntryAssistantDismissed && cookieConsentResolved && !trackedIntroClosed.current) {
            trackedIntroClosed.current = true;
            void trackFounderFunnelEvent('founder_intro_panels_closed');
        }
        // Auto-start if not completed, and both panels are dismissed
        if (!tourCompleted && isEntryAssistantDismissed && cookieConsentResolved) {
            const timeout = setTimeout(() => {
                startTour();
            }, 1500); // wait for layouts to settle after panels disappear
            return () => clearTimeout(timeout);
        }
    }, [tourCompleted, isEntryAssistantDismissed, cookieConsentResolved]);

    // Support manual restarts via custom event
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleStart = () => {
            localStorage.removeItem(TOUR_KEY);
            setTourCompleted(false);
            setTimeout(() => startTour(), 500);
        };
        const handleDismiss = () => {
            localStorage.setItem(TOUR_KEY, 'true');
            setTourCompleted(true);
            driverRef.current?.destroy();
            void trackFounderFunnelEvent('founder_tour_dismissed');
        };

        window.addEventListener('indii:start_tour', handleStart);
        window.addEventListener('indii:dismiss_tour', handleDismiss);

        return () => {
            window.removeEventListener('indii:start_tour', handleStart);
            window.removeEventListener('indii:dismiss_tour', handleDismiss);
        };
    }, []);

    if (tourCompleted) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-[150] flex items-center gap-2">
            <button
                onClick={() => startTour()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] border border-purple-500/30"
            >
                <Play size={12} className="fill-current" />
                Start Tour
            </button>
            <button
                onClick={() => {
                    localStorage.setItem(TOUR_KEY, 'true');
                    setTourCompleted(true);
                    void trackFounderFunnelEvent('founder_tour_dismissed');
                }}
                className="p-2.5 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 border border-white/5 transition-all"
                title="Dismiss Tour"
                aria-label="Dismiss Tour Options"
            >
                <X size={14} />
            </button>
        </div>
    );
}
