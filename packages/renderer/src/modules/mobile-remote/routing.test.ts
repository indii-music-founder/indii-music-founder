import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildMobileRemotePairingUrl,
    buildMobileRemoteUrl,
    isMobileRemoteHost,
    isMobileRemotePath,
    isRemoteSurfaceDevice,
    isStudioExecutorSurface,
    shouldUseMobileRemoteSurface,
} from './routing';

describe('mobile remote routing contract', () => {
    it('uses app.indii.music as the canonical Controller origin', () => {
        expect(buildMobileRemoteUrl()).toBe('https://app.indii.music/mobile-remote');
        expect(buildMobileRemoteUrl('?code=abc', '#pair')).toBe(
            'https://app.indii.music/mobile-remote?code=abc#pair'
        );
    });

    it('builds an encoded one-click pairing link on the Controller origin', () => {
        const code = 'a'.repeat(64);
        expect(buildMobileRemotePairingUrl(code)).toBe(
            `https://app.indii.music/mobile-remote?code=${code}`
        );
        expect(buildMobileRemotePairingUrl('code with spaces', 'http://localhost:5173')).toBe(
            'http://localhost:5173/mobile-remote?code=code+with+spaces'
        );
    });

    it('recognizes only the dedicated Controller host', () => {
        expect(isMobileRemoteHost('app.indii.music')).toBe(true);
        expect(isMobileRemoteHost('indii.music')).toBe(false);
        expect(isMobileRemoteHost('founder.indii.music')).toBe(false);
    });

    it('recognizes the remote route with or without a trailing slash', () => {
        expect(isMobileRemotePath('/mobile-remote')).toBe(true);
        expect(isMobileRemotePath('/mobile-remote/')).toBe(true);
        expect(isMobileRemotePath('/legal')).toBe(false);
    });
});

describe('remote surface device and executor boundaries', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('routes phones and touch tablets to the Controller', () => {
        expect(isRemoteSurfaceDevice({
            isAnyPhone: true,
            isTablet: false,
            isTouchDevice: true,
        })).toBe(true);
        expect(isRemoteSurfaceDevice({
            isAnyPhone: false,
            isTablet: true,
            isTouchDevice: true,
        })).toBe(true);
    });

    it('never lets a Controller surface become a Studio executor', () => {
        expect(isStudioExecutorSurface('mobile-remote', false)).toBe(false);
        expect(isStudioExecutorSurface('dashboard', true)).toBe(false);
        expect(isStudioExecutorSurface('dashboard', false)).toBe(true);
    });

    it('does not misclassify a desktop-width Mac browser with touch points as an iPad', () => {
        vi.stubGlobal('navigator', {
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            platform: 'MacIntel',
            maxTouchPoints: 5,
        });

        expect(isRemoteSurfaceDevice({
            isAnyPhone: false,
            isTablet: false,
            isTouchDevice: true,
        })).toBe(false);
        expect(isRemoteSurfaceDevice({
            isAnyPhone: false,
            isTablet: true,
            isTouchDevice: true,
        })).toBe(true);
    });

    it('routes mobile/tablet devices to Controller and computer browsers to regular Studio app on app.indii.music', () => {
        expect(shouldUseMobileRemoteSurface({
            hostname: 'app.indii.music',
            pathname: '/dashboard',
            isElectron: false,
            isRemoteDevice: true,
        })).toBe(true);
        expect(shouldUseMobileRemoteSurface({
            hostname: 'app.indii.music',
            pathname: '/dashboard',
            isElectron: false,
            isRemoteDevice: false,
        })).toBe(false);
        expect(shouldUseMobileRemoteSurface({
            hostname: 'indii.music',
            pathname: '/mobile-remote',
            isElectron: false,
            isRemoteDevice: false,
        })).toBe(true);
        expect(shouldUseMobileRemoteSurface({
            hostname: '',
            pathname: '/',
            isElectron: true,
            isRemoteDevice: true,
        })).toBe(false);
    });

    it.each([
        '/privacy',
        '/privacy/',
        '/legal/privacy',
        '/terms',
        '/legal/terms',
        '/tax-form-upload',
        '/login',
        '/signin',
        '/signup',
        '/register',
        '/auth/instagram/callback',
        '/auth/spotify/callback',
        '/presave/campaign-123',
    ])('keeps the public or authentication route %s out of the Controller on phones', pathname => {
        expect(shouldUseMobileRemoteSurface({
            hostname: 'app.indii.music',
            pathname,
            isElectron: false,
            isRemoteDevice: true,
        })).toBe(false);
    });
});
