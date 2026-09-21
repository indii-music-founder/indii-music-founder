import { describe, expect, it } from 'vitest';
import { buildInstagramFeedPayload, instagramCaptionLength, isPublishableMediaUrl } from './instagramComposer';

const feedImage = { publishUrl: 'https://cdn.example.test/feed.png', width: 1080, height: 1350 };

describe('Instagram composer contract', () => {
    it('requires the selected image to be a verified 1080x1350 feed asset', () => {
        expect(() => buildInstagramFeedPayload('New release.', '#detroitindie #synthpop #newrelease', { ...feedImage, width: 1080, height: 1080 }))
            .toThrow('feed media must be exactly 1080x1350px');
    });

    it('keeps hashtags separate and counts the final published caption', () => {
        expect(buildInstagramFeedPayload('New release. #not-a-tag', '#detroitindie #synthpop #newrelease', feedImage).caption).toBe('New release.');
        expect(instagramCaptionLength('New release.', '#detroitindie #synthpop #newrelease')).toBeGreaterThan('New release.'.length);
    });

    it('rejects generic tag blocks instead of silently substituting defaults', () => {
        expect(() => buildInstagramFeedPayload('New release.', '#music #viral #explore', feedImage)).toThrow('Generic hashtags are not allowed');
    });

    it('accepts a publishable remote URL but rejects temporary canvas media', () => {
        expect(isPublishableMediaUrl(feedImage.publishUrl)).toBe(true);
        expect(isPublishableMediaUrl('data:image/png;base64,temporary')).toBe(false);
        expect(isPublishableMediaUrl('gs://bucket/users/artist/asset')).toBe(false);
    });
});
