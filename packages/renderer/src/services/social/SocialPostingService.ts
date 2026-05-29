import { logger } from '@/utils/logger';
import { featureFlags, FEATURE_FLAG_NAMES } from '@/config/featureFlags';

/**
 * Requirement 141: Multi-Platform Auto-Poster
 *
 * Real implementations require TikTok Content Posting API, YouTube Data API v3,
 * and IG Graph API credentials. Gated behind `enable_social_posting` feature flag.
 */

export type ShortFormPlatform = 'TikTok' | 'YouTube Shorts' | 'IG Reels';

export interface PostRequest {
    videoUrl: string;
    caption: string;
    hashtags?: string[];
    platforms: ShortFormPlatform[];
}

export interface PostResult {
    platform: ShortFormPlatform;
    success: boolean;
    postId?: string;
    error?: string;
}

export class SocialPostingService {

    /**
     * Dispatches a single short-form video to multiple platforms simultaneously.
     */
    async autopostMultiPlatform(request: PostRequest): Promise<PostResult[]> {
        if (!featureFlags.isEnabled(FEATURE_FLAG_NAMES.SOCIAL_POSTING)) {
            logger.warn('[SocialPostingService] Social posting is disabled (feature flag: enable_social_posting).');
            return request.platforms.map(platform => ({
                platform,
                success: false,
                error: 'Social posting is not enabled. Enable the `enable_social_posting` feature flag.',
            }));
        }

        logger.info(`[SocialPostingService] Initiating multi-platform autopost for ${request.videoUrl}...`);

        const results = await Promise.all(request.platforms.map(p => this.postToPlatform(p, request)));

        const successCount = results.filter(r => r.success).length;
        logger.info(`[SocialPostingService] Autopost complete. ${successCount}/${request.platforms.length} successful.`);

        return results;
    }

    private async postToPlatform(platform: ShortFormPlatform, request: PostRequest): Promise<PostResult> {
        try {
            logger.info(`[SocialPostingService] Preparing payload for ${platform}...`);

            const formattedTags = request.hashtags?.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ') || '';
            const finalCaption = `${request.caption}\n\n${formattedTags}`.trim();
            const dispatchPlatform = this.toDispatchPlatform(platform);

            const { functionsWest1 } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');
            const dispatchFunction = httpsCallable<
                { mediaUrl: string; platform: string; caption: string },
                { success: boolean; externalId: string }
            >(functionsWest1, 'dispatchSocialPost');

            const result = await dispatchFunction({
                mediaUrl: request.videoUrl,
                platform: dispatchPlatform,
                caption: finalCaption
            });

            if (!result.data.success || !result.data.externalId) {
                throw new Error(`dispatchSocialPost did not queue ${platform}`);
            }

            logger.info(`[SocialPostingService] Queued ${platform} delivery (ID: ${result.data.externalId})`);

            return {
                platform,
                success: true,
                postId: result.data.externalId
            };

        } catch (error: unknown) {
            logger.error(`[SocialPostingService] Failed to post to ${platform}`, error);
            return {
                platform,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private toDispatchPlatform(platform: ShortFormPlatform): 'tiktok' | 'meta_reels' {
        if (platform === 'TikTok') return 'tiktok';
        if (platform === 'IG Reels') return 'meta_reels';
        throw new Error('YouTube Shorts delivery is not wired. Deploy a YouTube Data API delivery worker before enabling this platform.');
    }
}

export const socialPostingService = new SocialPostingService();
