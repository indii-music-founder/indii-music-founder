/**
 * useMobile — Centralized mobile detection for indiiOS
 *
 * Replaces all ad-hoc `window.innerWidth < 768` checks.
 * Built on top of the existing `useMediaQuery` hook for SSR-safe,
 * reactive breakpoint detection.
 *
 * Breakpoints:
 *   phone:      ≤ 430px  (iPhone 17 Pro Max = 430×932 logical)
 *   phone-lg:   431–640px (large phones landscape, small tablets)
 *   tablet:     641–1024px (iPad Mini, iPad 10")
 *   desktop:    1025–1440px (laptops)
 *   desktop-xl: > 1440px (large monitors)
 *
 * @example
 * const { isPhone, isTablet, isDesktop, deviceType } = useMobile();
 * if (isPhone) return <MobileLayout />;
 */

import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useMemo, useEffect, useState, useRef } from 'react';

// ============================================================================
// Breakpoint Constants (exported for use in CSS-in-JS or tests)
// ============================================================================

export const BREAKPOINTS = {
    /** iPhone 17 Pro Max logical width */
    PHONE_MAX: 430,
    /** Boundary between phone-lg and tablet */
    PHONE_LG_MAX: 640,
    /** Boundary between tablet and desktop */
    TABLET_MAX: 1024,
    /** Boundary between desktop and desktop-xl */
    DESKTOP_MAX: 1440,
} as const;

export type DeviceType = 'phone' | 'phone-lg' | 'tablet' | 'desktop' | 'desktop-xl';
export type Orientation = 'portrait' | 'landscape';

// ============================================================================
// Main Hook
// ============================================================================

export interface MobileState {
    /** True for screens ≤ 430px (most handheld phones in portrait) */
    isPhone: boolean;
    /** True for screens 431–640px (large phones in landscape, small tablets) */
    isPhoneLg: boolean;
    /** True for any phone-class device (≤ 640px) */
    isAnyPhone: boolean;
    /** True for screens 641–1024px (tablets) */
    isTablet: boolean;
    /** True for screens > 1024px */
    isDesktop: boolean;
    /** True for screens > 1440px */
    isDesktopXl: boolean;
    /** Computed device type string */
    deviceType: DeviceType;
    /** Current viewport orientation */
    orientation: Orientation;
    /** True when the virtual keyboard is estimated to be open */
    isKeyboardOpen: boolean;
    /** True when the user has enabled reduced motion in OS settings */
    prefersReducedMotion: boolean;
    /** True when the device has a coarse pointer (touch screen) */
    isTouchDevice: boolean;
    /** True when running as an installed PWA */
    isStandalone: boolean;
}

export function useMobile(): MobileState {
    // Media query breakpoints — these are reactive (update on resize/rotation)
    const isPhone = useMediaQuery(`(max-width: ${BREAKPOINTS.PHONE_MAX}px)`);
    const isPhoneLg = useMediaQuery(`(min-width: ${BREAKPOINTS.PHONE_MAX + 1}px) and (max-width: ${BREAKPOINTS.PHONE_LG_MAX}px)`);
    const isTabletRange = useMediaQuery(`(min-width: ${BREAKPOINTS.PHONE_LG_MAX + 1}px) and (max-width: ${BREAKPOINTS.TABLET_MAX}px)`);
    const isDesktopRange = useMediaQuery(`(min-width: ${BREAKPOINTS.TABLET_MAX + 1}px)`);
    const isDesktopXl = useMediaQuery(`(min-width: ${BREAKPOINTS.DESKTOP_MAX + 1}px)`);

    // Orientation
    const isLandscape = useMediaQuery('(orientation: landscape)');

    // Accessibility & capabilities
    const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
    const isTouchDevice = useMediaQuery('(pointer: coarse)');
    const isStandalone = useMediaQuery('(display-mode: standalone)');

    // Derived: any phone-class device
    const isAnyPhone = isPhone || isPhoneLg;

    // Keyboard detection (imperative — not a media query)
    // Only runs the viewport resize listener when on a phone-class device
    const isKeyboardOpen = useKeyboardDetection(isAnyPhone);

    // Device type enum
    const deviceType = useMemo((): DeviceType => {
        if (isPhone) return 'phone';
        if (isPhoneLg) return 'phone-lg';
        if (isTabletRange) return 'tablet';
        if (isDesktopXl) return 'desktop-xl';
        return 'desktop';
    }, [isPhone, isPhoneLg, isTabletRange, isDesktopXl]);

    const orientation: Orientation = isLandscape ? 'landscape' : 'portrait';

    return {
        isPhone,
        isPhoneLg,
        isAnyPhone,
        isTablet: isTabletRange,
        isDesktop: isDesktopRange,
        isDesktopXl,
        deviceType,
        orientation,
        isKeyboardOpen,
        prefersReducedMotion,
        isTouchDevice,
        isStandalone,
    };
}

// ============================================================================
// Keyboard Detection Hook (internal)
// ============================================================================

/**
 * Detects when the virtual keyboard is open by monitoring viewport height changes.
 * Only active on phone-class devices.
 */
function useKeyboardDetection(isPhoneDevice: boolean): boolean {
    const [isOpen, setIsOpen] = useState(false);
    const baselineRef = useRef<number>(
        typeof window !== 'undefined'
            ? (window.visualViewport?.height ?? window.innerHeight)
            : 0
    );

    useEffect(() => {
        if (!isPhoneDevice || typeof window === 'undefined') {
            return;
        }

        baselineRef.current = window.visualViewport?.height ?? window.innerHeight;

        const checkKeyboard = () => {
            const currentHeight = window.visualViewport?.height ?? window.innerHeight;

            // If viewport grew, update baseline (orientation change or browser chrome retracted)
            if (currentHeight >= baselineRef.current) {
                baselineRef.current = currentHeight;
                setIsOpen(false);
            } else {
                // Viewport shrunk — keyboard is open if the difference exceeds 150px
                const diff = baselineRef.current - currentHeight;
                setIsOpen(diff > 150);
            }
        };

        const handleOrientationChange = () => {
            setTimeout(() => {
                baselineRef.current = window.visualViewport?.height ?? window.innerHeight;
                setIsOpen(false);
            }, 150);
        };

        window.visualViewport?.addEventListener('resize', checkKeyboard);
        window.addEventListener('resize', checkKeyboard);
        window.addEventListener('orientationchange', handleOrientationChange);

        return () => {
            window.visualViewport?.removeEventListener('resize', checkKeyboard);
            window.removeEventListener('resize', checkKeyboard);
            window.removeEventListener('orientationchange', handleOrientationChange);
        };
    }, [isPhoneDevice]);

    // If not a phone device, always return false
    return isPhoneDevice ? isOpen : false;
}

// ============================================================================
// Convenience: Non-hook utility (for use outside React components)
// ============================================================================

/**
 * Imperative check — use inside event handlers or services where hooks aren't available.
 * Prefer `useMobile()` in React components.
 */
export function getDeviceType(): DeviceType {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    if (w <= BREAKPOINTS.PHONE_MAX) return 'phone';
    if (w <= BREAKPOINTS.PHONE_LG_MAX) return 'phone-lg';
    if (w <= BREAKPOINTS.TABLET_MAX) return 'tablet';
    if (w <= BREAKPOINTS.DESKTOP_MAX) return 'desktop';
    return 'desktop-xl';
}

/**
 * Quick boolean check — is the current viewport phone-class?
 * Prefer `useMobile().isAnyPhone` in React components.
 */
export function isPhoneViewport(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= BREAKPOINTS.PHONE_LG_MAX;
}
