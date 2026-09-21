import {
    formatInstagramCaption,
    normalizeInstagramHashtags,
    validateInstagramPublishingPayload,
    type InstagramPublishingPayload,
} from '@indii/shared';

export interface VerifiedInstagramImage {
    publishUrl: string;
    width: number;
    height: number;
}

export function isPublishableMediaUrl(url: string): boolean {
    return /^https?:\/\//iu.test(url);
}

function stripCaptionHashtags(caption: string): string {
    return caption.replace(/#[^\s#]+/gu, '').replace(/\s{2,}/gu, ' ').trim();
}

export function buildInstagramFeedPayload(
    caption: string,
    hashtagInput: string,
    image: VerifiedInstagramImage,
): InstagramPublishingPayload {
    const hashtags = normalizeInstagramHashtags(hashtagInput.split(/[\s,]+/u));
    const payload: InstagramPublishingPayload = {
        surface: 'feed',
        width: image.width,
        height: image.height,
        caption: stripCaptionHashtags(caption),
        hashtags,
    };
    const policy = validateInstagramPublishingPayload(payload);
    if (!policy.valid) throw new Error(policy.errors[0] || 'Instagram publishing details are invalid.');
    return { ...payload, hashtags: policy.normalizedHashtags };
}

export function instagramCaptionLength(caption: string, hashtagInput: string): number {
    return formatInstagramCaption(stripCaptionHashtags(caption), hashtagInput.split(/[\s,]+/u)).length;
}
