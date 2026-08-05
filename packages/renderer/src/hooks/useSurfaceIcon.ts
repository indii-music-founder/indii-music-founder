import { useEffect } from 'react';

const DEFAULT_ICON = '/favicon.svg';
const DEFAULT_MANIFEST = '/manifest.json';
const REMOTE_ICON = '/favicon-remote.svg';
const REMOTE_MANIFEST = '/manifest-remote.json';

/**
 * ISSUE-1164: the mobile-remote Controller surface shares index.html/manifest.json
 * with the regular Studio app, so the tab/home-screen icon can't be set per-surface
 * at build time. Swap the <link> tags at runtime instead, once routing determines
 * which surface is active.
 */
export function useSurfaceIcon(shouldUseRemoteSurface: boolean): void {
    useEffect(() => {
        if (typeof document === 'undefined') return;

        const iconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (!iconLink || !manifestLink) return;

        iconLink.href = shouldUseRemoteSurface ? REMOTE_ICON : DEFAULT_ICON;
        manifestLink.href = shouldUseRemoteSurface ? REMOTE_MANIFEST : DEFAULT_MANIFEST;

        return () => {
            iconLink.href = DEFAULT_ICON;
            manifestLink.href = DEFAULT_MANIFEST;
        };
    }, [shouldUseRemoteSurface]);
}
