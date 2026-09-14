import type { MobileState } from '@/hooks/useMobile';

export const MOBILE_REMOTE_ORIGIN = 'https://app.indii.music';
export const MOBILE_REMOTE_PATH = '/mobile-remote';

/**
 * Detects whether the device is an iPad or a tablet.
 * iPadOS 13+ Safari presents as `MacIntel` with multi-touch support (`navigator.maxTouchPoints > 1`).
 */
export function isIpadOrTabletDevice(
    mobile: Pick<MobileState, 'isTablet' | 'isTouchDevice'>
): boolean {
    const isIpadUA = typeof navigator !== 'undefined' &&
                     ((/iPad/i.test(navigator.userAgent)) ||
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    // Tablets (iPadOS, Android tablets) within tablet range or touch-enabled iPad UA
    return (mobile.isTablet && (mobile.isTouchDevice || isIpadUA)) ||
           (isIpadUA && (mobile.isTouchDevice || (typeof window !== 'undefined' && window.innerWidth <= 1366)));
}

export function isRemoteSurfaceDevice(
    mobile: Pick<MobileState, 'isAnyPhone' | 'isTablet' | 'isTouchDevice'>
): boolean {
    // Companion Remote Controller is only for actual mobile phones.
    // Tablets and iPads route to the full Web Studio.
    if (isIpadOrTabletDevice(mobile)) {
        return false;
    }
    return Boolean(mobile.isAnyPhone);
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

    // Mobile phones open the Remote Control surface.
    // Tablets (iPad) and desktop / computer browsers loading app.indii.music or any web domain load the regular Studio app.
    return input.isRemoteDevice;
}
