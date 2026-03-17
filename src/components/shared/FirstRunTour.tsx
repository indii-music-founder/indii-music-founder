import { useEffect, useRef } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';

/**
 * Item 290: Contextual First-Run Tour
 *
 * Uses driver.js to highlight key UI affordances for first-time users:
 *   1. Command Bar (⌘K) — universal search and action launcher
 *   2. Module switcher (sidebar) — navigate between 20+ departments
 *   3. AI Chat panel — floating agent for intelligent assistance
 *   4. Quick actions — context-sensitive right panel
 *
 * Tour is shown once per browser profile, stored in localStorage under
 * `indiiOS_tour_completed_v1`. Skipping also sets the flag.
 *
 * Usage:
 *   Mount <FirstRunTour /> once in App.tsx after the main layout renders.
 *   It self-manages its own lifecycle.
 */

const TOUR_KEY = 'indiiOS_tour_completed_v1';
const TOUR_DELAY_MS = 2_000; // wait for layout to settle

export function FirstRunTour() {
    const driverRef = useRef<Driver | null>(null);

    useEffect(() => {
        // Don't show if already completed or explicitly skipped
        if (localStorage.getItem(TOUR_KEY) === 'true') return;
        // Don't show during onboarding flow
        if (window.location.hash.includes('onboarding')) return;

        const timeout = setTimeout(() => {
            const d = driver({
                showProgress: true,
                animate: true,
                smoothScroll: true,
                overlayColor: 'rgba(0, 0, 0, 0.75)',
                stagePadding: 6,
                stageRadius: 10,
                popoverClass: 'indiiOS-tour-popover',
                nextBtnText: 'Next →',
                prevBtnText: '← Back',
                doneBtnText: 'Get Started',
                onDestroyStarted: () => {
                    localStorage.setItem(TOUR_KEY, 'true');
                    d.destroy();
                },
                steps: [
                    {
                        // Step 1: Sidebar
                        element: '[data-testid="nav-item-dashboard"], nav[aria-label="Main navigation"]',
                        popover: {
                            title: 'Your Creative OS',
                            description:
                                'indiiOS is your all-in-one platform. Use the sidebar to navigate between 20+ departments — Creative, Distribution, Finance, Marketing, Legal, and more.',
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
                                'Press ⌘K (or Ctrl+K) to open the Command Bar — your universal launcher for actions, search, and AI tasks across every module.',
                            side: 'bottom',
                            align: 'center',
                        },
                    },
                    {
                        // Step 3: AI Chat / Agent panel
                        element: '[data-testid="chat-toggle"], [aria-label*="agent" i], [aria-label*="AI" i], [aria-label*="chat" i]',
                        popover: {
                            title: 'AI Agent',
                            description:
                                'Your AI assistant is always one click away. Ask it to generate campaign briefs, review contracts, write lyrics, plan tours, or take any action across the platform.',
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
            }
        }, TOUR_DELAY_MS);

        return () => {
            clearTimeout(timeout);
            driverRef.current?.destroy();
        };
    }, []);

    return null;
}
