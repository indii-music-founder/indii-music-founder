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

    return mobile.isAnyPhone || (mobile.isTablet && (mobile.isTouchDevice || isIpadUA)) || isIpadUA;
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

    // Mobile phones and tablets (specifically iPad) open the Remote Control surface.
    // Desktop / computer browsers loading app.indii.music or any web domain load the regular Studio app.
    return input.isRemoteDevice;
}
