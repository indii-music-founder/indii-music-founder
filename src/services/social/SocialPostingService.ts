import { logger } from '@/utils/logger';

/**
 * Requirement 141: Multi-Platform Auto-Poster
 * Mocks direct API integrations to queue and post videos to TikTok, YouTube Shorts, and IG Reels natively.
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

            // Mock API network delay (e.g. video processing/upload time)
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

            // In a production environment, this is where we would use the respective Graph APIs
            // e.g., TikTok Content Posting API, YouTube Data API v3 (videos.insert), IG Graph API

            // Simulate random occasional API rejection (like a rate limit or bad token)
            if (Math.random() < 0.1) {
                throw new Error(`${platform} API rejected the upload token.`);
            }

            const mockedPostId = `${platform.toLowerCase().replace(' ', '_')}_${Math.random().toString(36).substring(7)}`;

            logger.info(`[SocialPostingService] Successfully posted to ${platform} (ID: ${mockedPostId})`);

            return {
                platform,
                success: true,
                postId: mockedPostId
            };

        } catch (error: any) {
            logger.error(`[SocialPostingService] Failed to post to ${platform}`, error);
            return {
                platform,
                success: false,
                error: error.message
            };
        }
    }
}

export const socialPostingService = new SocialPostingService();