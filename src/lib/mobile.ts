/**
 * Mobile Utilities
 * Provides haptic feedback, PWA install prompts, and mobile-specific features
 */

// ============================================================================
// Haptic Feedback
// ============================================================================

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Trigger haptic feedback on supported devices
 */
export const haptic = (pattern: HapticPattern = 'light'): void => {
    // Check if Vibration API is supported
    if (!navigator.vibrate) return;

    const patterns: Record<HapticPattern, number | number[]> = {
        light: 10,
        medium: 20,
        heavy: 30,
        success: [10, 50, 10], // Double tap
        warning: [20, 100, 20, 100, 20], // Triple tap
        error: [50, 100, 50], // Strong double tap
    };

    navigator.vibrate(patterns[pattern]);
};

// ============================================================================
// Device Detection
// ============================================================================

export const isMobile = (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const isIOS = (): boolean => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

export const isAndroid = (): boolean => {
    return /Android/i.test(navigator.userAgent);
};

export const isStandalone = (): boolean => {
    // Check if running as installed PWA
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
    );
};

// ============================================================================
// PWA Install Prompt
// ============================================================================

let deferredPrompt: any = null;

/**
 * Listen for the beforeinstallprompt event
 */
export const initPWAInstall = (): void => {
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;

        // Dispatch custom event to notify UI
        window.dispatchEvent(new CustomEvent('pwa-installable'));
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        console.log('[PWA] App installed successfully');
    });
};

/**
 * Show PWA install prompt
 */
export const showPWAInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) {
        console.warn('[PWA] Install prompt not available');
        return false;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice;

    // Clear the deferredPrompt
    deferredPrompt = null;

    return outcome === 'accepted';
};

/**
 * Check if PWA install is available
 */
export const canInstallPWA = (): boolean => {
    return deferredPrompt !== null;
};

// ============================================================================
// Native Share API
// ============================================================================

export interface ShareData {
    title?: string;
    text?: string;
    url?: string;
    files?: File[];
}

/**
 * Share content using native share sheet
 */
export const nativeShare = async (data: ShareData): Promise<boolean> => {
    if (!navigator.share) {
        console.warn('[Share] Web Share API not supported');
        return false;
    }

    try {
        await navigator.share(data);
        return true;
    } catch (error) {
        if ((error as Error).name === 'AbortError') {
            // User cancelled the share
            return false;
        }
        console.error('[Share] Error:', error);
        return false;
    }
};

/**
 * Check if native share is available
 */
export const canShare = (data?: ShareData): boolean => {
    if (!navigator.share) return false;
    if (!data) return true;

    return navigator.canShare ? navigator.canShare(data) : true;
};

// ============================================================================
// Screen Wake Lock (prevent sleep during long operations)
// ============================================================================

let wakeLock: any = null;

/**
 * Request screen wake lock to prevent device from sleeping
 */
export const requestWakeLock = async (): Promise<boolean> => {
    if (!('wakeLock' in navigator)) {
        console.warn('[WakeLock] Wake Lock API not supported');
        return false;
    }

    try {
        wakeLock = await (navigator as any).wakeLock.request('screen');

        wakeLock.addEventListener('release', () => {
            console.log('[WakeLock] Released');
        });

        return true;
    } catch (error) {
        console.error('[WakeLock] Error:', error);
        return false;
    }
};

/**
 * Release screen wake lock
 */
export const releaseWakeLock = async (): Promise<void> => {
    if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
    }
};

// ============================================================================
// Viewport Height Fix (for iOS address bar)
// ============================================================================

/**
 * Fix viewport height on mobile (especially iOS)
 * Call this on mount and window resize
 */
export const fixViewportHeight = (): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return; // SSR or non-browser environment
    }

    // Set CSS variable for actual viewport height
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
};

/**
 * Initialize viewport height fixes and resize listener
 * Call this once on app bootstrap (client-side only)
 */
export const initViewportFixes = (): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return; // SSR or non-browser environment
    }

    // Initial fix
    fixViewportHeight();

    // Auto-update on resize
    window.addEventListener('resize', fixViewportHeight);
};

// ============================================================================
// Safe Area Insets
// ============================================================================

/**
 * Get safe area insets for notch/island support
 */
export const getSafeAreaInsets = () => {
    const getInset = (side: string): number => {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue(`--safe-area-inset-${side}`);
        return parseInt(value) || 0;
    };

    return {
        top: getInset('top'),
        right: getInset('right'),
        bottom: getInset('bottom'),
        left: getInset('left'),
    };
};

// ============================================================================
// Keyboard Detection
// ============================================================================

let isKeyboardOpen = false;
let originalHeight = 0; // Mutable baseline for keyboard detection

/**
 * Detect if mobile keyboard is open
 */
export const detectKeyboard = (): boolean => {
    return isKeyboardOpen;
};

/**
 * Initialize keyboard detection listeners
 * Call this once on app bootstrap (client-side only, mobile devices)
 */
export const initKeyboardDetection = (): void => {
    if (typeof window === 'undefined' || !isMobile()) {
        return; // SSR, non-browser, or desktop environment
    }

    // Initialize baseline height
    originalHeight = window.visualViewport?.height || window.innerHeight;

    const checkKeyboard = () => {
        const currentHeight = window.visualViewport?.height || window.innerHeight;

        // If viewport grew (orientation change, browser chrome), update baseline
        if (currentHeight >= originalHeight) {
            originalHeight = currentHeight;
            isKeyboardOpen = false;
        } else {
            // Viewport shrunk - check if keyboard opened
            const heightDiff = originalHeight - currentHeight;
            // If viewport shrunk by more than 150px, keyboard is probably open
            isKeyboardOpen = heightDiff > 150;
        }

        // Dispatch event
        window.dispatchEvent(new CustomEvent('keyboard-change', {
            detail: { isOpen: isKeyboardOpen }
        }));
    };

    // Handle orientation changes (update baseline)
    const handleOrientationChange = () => {
        // Wait for orientation change to complete
        setTimeout(() => {
            originalHeight = window.visualViewport?.height || window.innerHeight;
            isKeyboardOpen = false;
            window.dispatchEvent(new CustomEvent('keyboard-change', {
                detail: { isOpen: false }
            }));
        }, 100);
    };

    // Listen for resize events
    window.visualViewport?.addEventListener('resize', checkKeyboard);
    window.addEventListener('resize', checkKeyboard);

    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
};

// ============================================================================
// Network Status
// ============================================================================

export const isOnline = (): boolean => {
    return navigator.onLine;
};

export const onNetworkChange = (callback: (online: boolean) => void): (() => void) => {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return cleanup function
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
};

// ============================================================================
// Battery Status
// ============================================================================

export const getBatteryStatus = async () => {
    if (!('getBattery' in navigator)) {
        return null;
    }

    try {
        const battery = await (navigator as any).getBattery();
        return {
            level: battery.level,
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime,
        };
    } catch {
        return null;
    }
};
