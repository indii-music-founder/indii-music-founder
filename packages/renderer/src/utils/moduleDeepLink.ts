import { isValidModule, type ModuleId } from '@/core/constants';

/**
 * Reads a ?module=<id> deep link from a query string so external surfaces
 * (e.g. the founder site's "Secure Founder Access" button) can land a signed-in
 * user directly on a specific module such as founders-checkout.
 *
 * Returns null for missing, unknown, or invalid module ids — callers must not
 * crash on hand-typed URLs.
 */
export function readModuleDeepLink(search: string): ModuleId | null {
    if (!search) return null;
    const value = new URLSearchParams(search).get('module');
    return value && isValidModule(value) ? (value as ModuleId) : null;
}

/**
 * Convenience wrapper for browser usage; returns null outside the DOM.
 */
export function readModuleDeepLinkFromLocation(): ModuleId | null {
    if (typeof window === 'undefined') return null;
    return readModuleDeepLink(window.location.search);
}
