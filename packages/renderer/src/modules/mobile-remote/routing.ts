import type { MobileState } from '@/hooks/useMobile';

export const MOBILE_REMOTE_ORIGIN = 'https://app.indii.music';
export const MOBILE_REMOTE_PATH = '/mobile-remote';

export function isRemoteSurfaceDevice(
    mobile: Pick<MobileState, 'isAnyPhone' | 'isTablet' | 'isTouchDevice'>
): boolean {
    // iPadOS 13+ Safari presents as MacIntel with multi-touch support
    const isIpadUA = typeof navigator !== 'undefined' && 
                     ((/iPad/i.test(navigator.userAgent)) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    // Mac browser automation and some touch-capable laptops can expose
    // `MacIntel` plus multiple touch points at a full desktop width. Treat the
    // iPad compatibility signal as authoritative only inside the tablet
    // breakpoint; otherwise a normal Studio reload can escape to the remote
    // Controller and lose the authenticated host.
    return mobile.isAnyPhone || (mobile.isTablet && (mobile.isTouchDevice || isIpadUA));
}

/**
 * The Controller is a command producer, never a Studio executor. This check
 * deliberately excludes a desktop-sized `/mobile-remote` page too; viewport
 * detection alone allowed that page to publish a fake Studio heartbeat.
 */
export function isStudioExecutorSurface(
    currentModule: string,
    shouldUseRemoteSurface: boolean
): boolean {
    return !shouldUseRemoteSurface && currentModule !== 'mobile-remote';
}

export function isMobileRemoteHost(hostname: string): boolean {
    return hostname.toLowerCase() === 'app.indii.music';
}

export function isMobileRemotePath(pathname: string): boolean {
    return (pathname.replace(/\/+$/, '') || '/') === MOBILE_REMOTE_PATH;
}

const MOBILE_REMOTE_BYPASS_PATHS = new Set([
    '/privacy',
    '/legal/privacy',
    '/terms',
    '/legal/terms',
    '/tax-form-upload',
    '/login',
    '/signin',
    '/signup',
    '/register',
]);

export function isMobileRemoteBypassPath(pathname: string): boolean {
    const normalizedPath = pathname.replace(/\/+$/, '') || '/';
    return MOBILE_REMOTE_BYPASS_PATHS.has(normalizedPath)
        || /^\/auth\/[^/]+\/callback$/.test(normalizedPath)
        || /^\/presave\/[A-Za-z0-9_-]{8,128}$/.test(normalizedPath);
}

export function buildMobileRemoteUrl(search = '', hash = ''): string {
    const normalizedSearch = search && !search.startsWith('?') ? `?${search}` : search;
    const normalizedHash = hash && !hash.startsWith('#') ? `#${hash}` : hash;
    return `${MOBILE_REMOTE_ORIGIN}${MOBILE_REMOTE_PATH}${normalizedSearch}${normalizedHash}`;
}

export function buildMobileRemotePairingUrl(code: string, origin = MOBILE_REMOTE_ORIGIN): string {
    const pairingUrl = new URL(MOBILE_REMOTE_PATH, origin);
    pairingUrl.searchParams.set('code', code);
    return pairingUrl.toString();
}

export function shouldUseMobileRemoteSurface(input: {
    hostname: string;
    pathname: string;
    isElectron: boolean;
    isRemoteDevice: boolean;
}): boolean {
    if (input.isElectron) return false;

    // Explicit /mobile-remote route always opens the Controller surface
    if (isMobileRemotePath(input.pathname)) return true;

    // Public, authentication, provider callback, and published pre-save routes
    // must reach App.tsx's route branches on every viewport. Device routing only
    // applies to Studio paths.
    if (isMobileRemoteBypassPath(input.pathname)) return false;

    // Mobile phones and tablets (specifically iPad) open the Remote Control surface.
    // Desktop / computer browsers loading app.indii.music or any web domain load the regular Studio app.
    return input.isRemoteDevice;
}
