import { useEffect } from 'react';

const DEFAULT_ICON = '/favicon.svg';
const DEFAULT_MANIFEST = '/manifest.json';
const DEFAULT_APPLE_TOUCH_ICON = '/apple-touch-icon.png';
const REMOTE_ICON = '/favicon-remote.svg';
const REMOTE_MANIFEST = '/manifest-remote.json';
const REMOTE_APPLE_TOUCH_ICON = '/icon-remote-192.png';

/**
 * ISSUE-1164: the mobile-remote Controller surface shares index.html/manifest.json
 * with the regular Studio app, so the tab/home-screen icon can't be set per-surface
 * at build time. Swap the <link> tags at runtime instead, once routing determines
 * which surface is active. The Apple touch icon must be handled separately because
 * iOS does not use the manifest icon when saving a site to the home screen.
 */
export function useSurfaceIcon(shouldUseRemoteSurface: boolean): void {
    useEffect(() => {
        if (typeof document === 'undefined') return;

        const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        const appleTouchIconLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');

        if (iconLink) iconLink.href = shouldUseRemoteSurface ? REMOTE_ICON : DEFAULT_ICON;
        if (manifestLink) manifestLink.href = shouldUseRemoteSurface ? REMOTE_MANIFEST : DEFAULT_MANIFEST;
        if (appleTouchIconLink) {
            appleTouchIconLink.href = shouldUseRemoteSurface
                ? REMOTE_APPLE_TOUCH_ICON
                : DEFAULT_APPLE_TOUCH_ICON;
        }

        return () => {
            if (iconLink) iconLink.href = DEFAULT_ICON;
            if (manifestLink) manifestLink.href = DEFAULT_MANIFEST;
            if (appleTouchIconLink) appleTouchIconLink.href = DEFAULT_APPLE_TOUCH_ICON;
        };
    }, [shouldUseRemoteSurface]);
}
