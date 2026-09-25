import { logger } from '@/utils/logger';
import { normalizeExternalHttpUrl } from '@/utils/safeExternalUrl';

// Type definitions for Window Management API
interface ScreenDetails {
    screens: ScreenDetailed[];
    currentScreen: ScreenDetailed;
    oncurrentscreenchange: ((this: ScreenDetails, ev: Event) => void) | null;
    onscreenschange: ((this: ScreenDetails, ev: Event) => void) | null;
}

interface ScreenDetailed extends Screen {
    availLeft: number;
    availTop: number;
    left: number;
    top: number;
    isPrimary: boolean;
    isInternal: boolean;
    devicePixelRatio: number;
    label: string;
}

declare global {
    interface Window {
        getScreenDetails(): Promise<ScreenDetails>;
    }
}

class ScreenControlService {
    private screenDetails: ScreenDetails | null = null;

    async isSupported(): Promise<boolean> {
        return 'getScreenDetails' in window;
    }

    /** True when multi-screen projector placement is possible at all (Chromium/Edge). */
    canProjectToSecondScreen(): boolean {
        return typeof window !== 'undefined' && 'getScreenDetails' in window;
    }

    async requestPermission(): Promise<boolean> {
        if (!await this.isSupported()) {
            logger.warn("Window Management API not supported.");
            return false;
        }
        try {
            this.screenDetails = await window.getScreenDetails();
            return true;
        } catch (e: unknown) {
            logger.error("Failed to get screen details:", e);
            return false;
        }
    }

    getScreens(): ScreenDetailed[] {
        return this.screenDetails?.screens || [];
    }

    /**
     * Open the viewer content in a dedicated window.
     *
     * Returns how it opened:
     * - 'projector': placed on a chosen screen via the Window Management API.
     * - 'popup': plain centered same-origin popup — the fallback for browsers
     *   without (or without permission for) the Window Management API. The
     *   viewer syncs over BroadcastChannel, so it never depended on opener
     *   access and works identically here.
     * - 'blocked': the popup was suppressed by a blocker.
     */
    openProjectorWindow(contentUrl: string, screenIndex: number = 1): 'projector' | 'popup' | 'blocked' {
        const openFallbackPopup = (): 'popup' | 'blocked' => {
            const safeContentUrl = normalizeExternalHttpUrl(contentUrl, window.location.origin);
            if (!safeContentUrl) {
                logger.error('Projector window rejected a non-HTTP content URL.');
                return 'blocked';
            }
            const width = Math.min(1280, Math.floor(window.screen.width * 0.75));
            const height = Math.min(800, Math.floor(window.screen.height * 0.75));
            const left = Math.max(0, Math.floor((window.screen.width - width) / 2));
            const top = Math.max(0, Math.floor((window.screen.height - height) / 2));
            const features = `left=${left},top=${top},width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no,noopener,noreferrer`;
            const opened = window.open(safeContentUrl, '_blank', features);
            if (!opened) {
                logger.warn('Pop-out popup was blocked by the browser.');
                return 'blocked';
            }
            return 'popup';
        };

        if (!this.screenDetails) {
            // No Window Management API (or permission not granted): fall back to
            // a plain popup instead of silently doing nothing (ISSUE-1433 follow-up).
            if (this.canProjectToSecondScreen()) {
                logger.warn('Screen details unavailable — falling back to a plain pop-out window.');
            }
            return openFallbackPopup();
        }

        const screens = this.screenDetails.screens;
        // Default to the second screen if available, else the first (or external)
        const targetScreen = screens[screenIndex] || screens.find(s => !s.isPrimary) || screens[0];

        if (!targetScreen) {
            return openFallbackPopup();
        }

        const safeContentUrl = normalizeExternalHttpUrl(contentUrl, window.location.origin);
        if (!safeContentUrl) {
            logger.error('Projector window rejected a non-HTTP content URL.');
            return 'blocked';
        }
        const options = {
            left: targetScreen.left,
            top: targetScreen.top,
            width: targetScreen.width,
            height: targetScreen.height,
            menubar: 'no',
            toolbar: 'no',
            location: 'no',
            status: 'no',
            resizable: 'yes',
            scrollbars: 'no'
        };

        const features = Object.entries(options)
            .map(([key, value]) => `${key}=${value}`)
            .join(',');

        // 🛡️ Sentinel: noopener/noreferrer stay set — the viewer syncs over
        // BroadcastChannel and never needed opener access.
        window.open(safeContentUrl, '_blank', `${features},noopener,noreferrer`);
        return 'projector';
    }
}

export const ScreenControl = new ScreenControlService();
