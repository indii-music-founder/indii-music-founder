import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSurfaceIcon } from './useSurfaceIcon';

const linkHref = (selector: string): string | null =>
    document.querySelector<HTMLLinkElement>(selector)?.getAttribute('href') ?? null;

describe('useSurfaceIcon', () => {
    beforeEach(() => {
        document.head.innerHTML = `
            <link rel="icon" href="/favicon.svg" />
            <link rel="manifest" href="/manifest.json" />
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        `;
    });

    afterEach(() => {
        document.head.innerHTML = '';
    });

    it('selects remote icons and manifest for the Controller surface', () => {
        renderHook(() => useSurfaceIcon(true));

        expect(linkHref('link[rel="icon"]')).toBe('/favicon-remote.svg');
        expect(linkHref('link[rel="manifest"]')).toBe('/manifest-remote.json');
        expect(linkHref('link[rel="apple-touch-icon"]')).toBe('/icon-remote-192.png');
    });

    it('restores Studio assets when the surface changes and on unmount', () => {
        const { rerender, unmount } = renderHook(
            ({ remote }: { remote: boolean }) => useSurfaceIcon(remote),
            { initialProps: { remote: true } },
        );

        rerender({ remote: false });
        expect(linkHref('link[rel="icon"]')).toBe('/favicon.svg');
        expect(linkHref('link[rel="manifest"]')).toBe('/manifest.json');
        expect(linkHref('link[rel="apple-touch-icon"]')).toBe('/apple-touch-icon.png');

        unmount();
        expect(linkHref('link[rel="icon"]')).toBe('/favicon.svg');
        expect(linkHref('link[rel="manifest"]')).toBe('/manifest.json');
        expect(linkHref('link[rel="apple-touch-icon"]')).toBe('/apple-touch-icon.png');
    });

    it('updates each available link independently', () => {
        document.querySelector('link[rel="manifest"]')?.remove();

        expect(() => renderHook(() => useSurfaceIcon(true))).not.toThrow();
        expect(linkHref('link[rel="icon"]')).toBe('/favicon-remote.svg');
        expect(linkHref('link[rel="apple-touch-icon"]')).toBe('/icon-remote-192.png');
    });
});
