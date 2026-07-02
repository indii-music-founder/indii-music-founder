/**
 * SocialAutoPosterService.ts
 * 
 * Manages native API integrations for posting media to TikTok, YouTube Shorts, and Meta.
 * Fulfills PRODUCTION_200 item #141.
 */

import { logger } from '@/utils/logger';
import { useStore } from '@/core/store';
import { MarketingProviderUnavailableError } from './providerErrors';

export type SocialPlatform = 'tiktok' | 'youtube_shorts' | 'meta_reels';

export interface PostContent {
    id: string;
    mediaUrl: string; // From Firebase Storage or GCS
    caption: string;
    hashtags: string[];
    scheduledTime?: number;
    platform: SocialPlatform;
}

export interface PostStatus {
    id: string;
    platform: SocialPlatform;
    status: 'queued' | 'publishing' | 'published' | 'failed';
    publicUrl?: string;
    externalId?: string;
    errorMessage?: string;
}

export class SocialAutoPosterService {
    /**
     * Queues a post for immediate or scheduled delivery to a social platform.
     */
    async queuePost(content: PostContent): Promise<string> {
        const store = useStore.getState();
        const jobId = `post_${Date.now()}`;

        logger.info(`[SocialPost] Queuing ${content.platform} post: ${content.id}`);

        // 1. Log job for UI feedback
        store.addJob({
            id: jobId,
            title: `Publishing to ${content.platform.replace('_', ' ')}...`,
            progress: 0,
            status: 'running',
            type: 'ai_generation' // Generic type for progress bar
        });

        try {
            // 2. Real Cloud Function call (dispatchSocialPost)
            // Fulfills PRODUCTION_200:141.
            const { functionsWest1 } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');

            interface DispatchPayload {
                mediaUrl: string;
                platform: string;
                caption: string;
            }

            const dispatchFunction = httpsCallable<DispatchPayload, { success: boolean; externalId: string; timestamp: string }>(
                functionsWest1,
                'dispatchSocialPost'
            );

            store.updateJobProgress(jobId, 25);

            const result = await dispatchFunction({
                mediaUrl: content.mediaUrl,
                platform: content.platform,
                caption: content.caption
            });

            if (result.data.success) {
                store.updateJobProgress(jobId, 100);
                store.updateJobStatus(jobId, 'success');
                logger.info(`[SocialPost] Queued ${content.platform} post. Queue ID: ${result.data.externalId}`);
            } else {
                throw new Error("Cloud Function returned failure status");
            }

            return jobId;

        } catch (error: unknown) {
            logger.error(`[SocialPost] Failed to queue ${content.platform} post:`, error);
            store.updateJobStatus(jobId, 'error', error instanceof Error ? error.message : 'Post failed to queue');
            throw error;
        }
    }

    /**
     * Revokes or deletes a scheduled post if it hasn't been published yet.
     */
    async revokePost(id: string): Promise<boolean> {
        // ISSUE-667: there is no backend revoke path yet — returning true fabricated
        // a cancellation that never happened. Fail honestly until one exists.
        logger.error(`[SocialPost] Cannot revoke post ${id}: no revoke backend is deployed.`);
        throw new MarketingProviderUnavailableError('Social poster', 'no post-revocation backend is deployed — the scheduled post was NOT cancelled');
    }

    /**
     * Gets engagement metrics for a published post.
     */
    async getPostInsights(externalId: string, platform: SocialPlatform) {
        logger.info(`[SocialPost] Fetching ${platform} insights for ${externalId}.`);

        // Item 141: Fetch real platform analytics via Cloud Function
        try {
            const { functionsWest1 } = await import('@/services/firebase');
            const { httpsCallable } = await import('firebase/functions');

            const getInsightsFn = httpsCallable<
                { externalId: string; platform: string },
                { views: number; likes: number; shares: number; comments: number; avgWatchTime: number }
            >(functionsWest1, 'getSocialPostInsights');

            const result = await getInsightsFn({ externalId, platform });
            return result.data;
        } catch (error: unknown) {
            // ISSUE-667: zero-filled metrics read as "no engagement", not "unavailable". Fail honestly.
            logger.error(`[SocialPost] Insights Cloud Function unavailable for ${platform}:${externalId}:`, error);
            throw new MarketingProviderUnavailableError(platform, "the 'getSocialPostInsights' backend is not deployed or rejected the request", { cause: error });
        }
    }
}

export const socialAutoPosterService = new SocialAutoPosterService();
