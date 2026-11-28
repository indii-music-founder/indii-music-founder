import { describe, expect, it } from 'vitest';
import {
    isBoardroomSpecialistPage,
    isBoardroomWebSearchQuery,
    parseBoardroomBrowserAddress,
    parseBoardroomPublicPage,
} from './boardroomBrowserPages';

describe('Boardroom public browser addresses', () => {
    it.each([
        ['indii.music', 'https://indii.music/'],
        ['https://artists.apple.com/', 'https://artists.apple.com/'],
        ['http://www.wikipedia.org/', 'https://www.wikipedia.org/'],
        ['https://www.loc.gov./collections/', 'https://www.loc.gov/collections/'],
    ])('opens a public address %s in the same browser', (address, expected) => {
        expect(parseBoardroomBrowserAddress(address)?.href).toBe(expected);
        expect(isBoardroomWebSearchQuery(address)).toBe(false);
    });

    it.each([
        'https://10.0.0.1/',
        'https://[::1]/',
        'https://metadata.google.internal/',
        'https://app.localhost./',
        'https://localhost/',
        'https://guest@indii.music/',
        'https://indii.music:8443/',
        'file:///public/index.html',
    ])('rejects an unsupported address %s', address => {
        expect(parseBoardroomBrowserAddress(address)).toBeUndefined();
    });

    it('leaves search terms in search and reserves specialist access for the existing research portals', () => {
        expect(isBoardroomWebSearchQuery('independent music news')).toBe(true);
        expect(parseBoardroomPublicPage('http://indii.music/')).toBeUndefined();
        expect(isBoardroomSpecialistPage('https://indii.music/')).toBe(false);
        expect(isBoardroomSpecialistPage('https://fonts.google.com/')).toBe(true);
        expect(isBoardroomSpecialistPage('https://artists.spotify.com/')).toBe(true);
    });
});
