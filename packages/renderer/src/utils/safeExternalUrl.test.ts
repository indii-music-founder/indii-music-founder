import { describe, expect, it } from 'vitest';
import { normalizeExternalHttpUrl } from './safeExternalUrl';

describe('normalizeExternalHttpUrl', () => {
    it('allows canonical HTTP and HTTPS links', () => {
        expect(normalizeExternalHttpUrl(' https://example.com/path?q=1 ')).toBe('https://example.com/path?q=1');
        expect(normalizeExternalHttpUrl('http://localhost:3000/share')).toBe('http://localhost:3000/share');
        expect(normalizeExternalHttpUrl('/video-popout', 'https://studio.indii.music')).toBe('https://studio.indii.music/video-popout');
    });

    it('rejects executable, local-file, malformed, and oversized URLs', () => {
        expect(normalizeExternalHttpUrl('javascript:alert(1)')).toBeNull();
        expect(normalizeExternalHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
        expect(normalizeExternalHttpUrl('file:///private/track.wav')).toBeNull();
        expect(normalizeExternalHttpUrl('not a url')).toBeNull();
        expect(normalizeExternalHttpUrl(`https://example.com/${'a'.repeat(2100)}`)).toBeNull();
    });
});
