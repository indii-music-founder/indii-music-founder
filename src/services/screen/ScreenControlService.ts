// Type definitions for Window Management API
interface ScreenDetails {
    screens: ScreenDetailed[];
    currentScreen: ScreenDetailed;
    oncurrentscreenchange: ((this: ScreenDetails, ev: Event) => any) | null;
    onscreenschange: ((this: ScreenDetails, ev: Event) => any) | null;
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

    async requestPermission(): Promise<boolean> {
        if (!await this.isSupported()) {
            console.warn("Window Management API not supported.");
            return false;
        }
        try {
            this.screenDetails = await window.getScreenDetails();
            return true;
        } catch (e) {
            console.error("Failed to get screen details:", e);
            return false;
        }
    }

    getScreens(): ScreenDetailed[] {
        return this.screenDetails?.screens || [];
    }

    openProjectorWindow(contentUrl: string, screenIndex: number = 1) {
        if (!this.screenDetails) {
            console.error("Permissions not granted or API not supported.");
            return;
        }

        const screens = this.screenDetails.screens;
        // Default to the second screen if available, else the first (or external)
        const targetScreen = screens[screenIndex] || screens.find(s => !s.isPrimary) || screens[0];

        if (targetScreen) {
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

            // 🛡️ Sentinel: Added noopener,noreferrer for security
            window.open(contentUrl, '_blank', `${features},noopener,noreferrer`);
        }
    }
}

export const ScreenControl = new ScreenControlService();
