import { describe, expect, it } from 'vitest';
import { buildArtistShareCard } from './artistShareCard';

describe('buildArtistShareCard', () => {
    it('keeps private email out until the artist opts in', () => {
        expect(buildArtistShareCard('Indii Artist')).toContain('FN:Indii Artist');
        expect(buildArtistShareCard('Indii Artist')).not.toContain('EMAIL');
        expect(buildArtistShareCard('Indii Artist', 'artist@example.com')).toContain('EMAIL;TYPE=INTERNET:artist@example.com');
    });
    it('escapes card syntax and refuses an empty artist name', () => {
        expect(buildArtistShareCard('A;B\nC')).toContain('FN:A\\;B\\nC');
        expect(() => buildArtistShareCard(' ')).toThrow();
    });
});
