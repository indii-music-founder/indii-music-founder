export const BOARDROOM_PORTAL_URLS = Object.freeze({
    ascap: 'https://members.ascap.com',
    bmi: 'https://online.bmi.com',
    the_mlc: 'https://portal.themlc.com',
    soundexchange: 'https://sportal.soundexchange.com',
    loc_copyright: 'https://eco.copyright.gov/eService_enu/',
    spotify: 'https://artists.spotify.com',
    apple: 'https://artists.apple.com',
    google_fonts: 'https://fonts.google.com/',
    instagram: 'https://www.instagram.com',
});

export function isSafeExternalAssetUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(
            rawUrl,
            typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
        );
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'blob:';
    } catch {
        return false;
    }
}
