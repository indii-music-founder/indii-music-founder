import { logger } from '@/utils/logger';
import { secureRandomAlphanumeric } from '@/utils/crypto-random';
import { featureFlags, FEATURE_FLAG_NAMES } from '@/config/featureFlags';

/**
 * Requirement 141: Multi-Platform Auto-Poster
 *
 * @mock This service is ENTIRELY MOCKED. It simulates API delays and random failures.
 *       Real implementations require TikTok Content Posting API, YouTube Data API v3,
 *       and IG Graph API credentials. Gated behind `enable_social_posting` feature flag.
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

            // Format caption with hashtags
            const formattedTags = request.hashtags?.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ') || '';
            const finalCaption = `${request.caption}\n\n${formattedTags}`.trim();

            // Mock API network delay (simulates upload/processing time)
            await new Promise(resolve => setTimeout(resolve, 2000));

            // In a production environment, this is where we would use the respective Graph APIs
            // e.g., TikTok Content Posting API, YouTube Data API v3 (videos.insert), IG Graph API

            // NOTE: Simulated random failure removed (was Math.random() < 0.1).
            // When real APIs are wired, genuine errors will surface naturally.

            const mockedPostId = `${platform.toLowerCase().replace(' ', '_')}_${secureRandomAlphanumeric(7)}`;

            logger.info(`[SocialPostingService] Successfully posted to ${platform} (ID: ${mockedPostId})`);

            return {
                platform,
                success: true,
                postId: mockedPostId
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
}

export const socialPostingService = new SocialPostingService();