import { AutonomousIntelligence, getResponseText } from '@/services/intelligence/AutonomousIntelligence';
import { SocialService } from '@/services/social/SocialService';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';
import { getFineTunedModel } from '../fine-tuned-models';
import { importWithRetry } from '@/utils/dynamicImport';
import { z } from 'zod';
import {
    ReleaseLaunchKitSchema,
    type InstagramPublishingPayload,
    type LaunchSocialPost,
    type ScoredAdVariantRecord,
} from '@indii/shared';

const MAX_SAFE_SCHEDULE_TIMESTAMP_MS = 8_640_000_000_000_000 - 91 * 86_400_000;

const ScheduleLaunchKitRolloutArgsSchema = z.object({
    launchKit: ReleaseLaunchKitSchema,
    startTimestampMs: z.number().finite().nonnegative().max(MAX_SAFE_SCHEDULE_TIMESTAMP_MS).optional(),
    reelAudienceIntent: z.enum(['discovery', 'nurture']).optional(),
}).passthrough();

// ============================================================================
// SocialTools Implementation
// ============================================================================

export const SocialTools = {
    generate_social_post: wrapTool('generate_social_post', async ({ platform, topic, tone }: { platform: string; topic: string; tone?: string }) => {
        const prompt = `Generate a ${tone || 'professional'} social media post for ${platform} about ${topic}. Include hashtags.`;

        const result = await AutonomousIntelligence.generateContent(
            prompt,
            getFineTunedModel('social')
        );
        const text = getResponseText(result);

        return toolSuccess({
            platform,
            content: text
        }, `Draft for ${platform}:\n${text}\n\nThis draft was not saved or posted.`);
    }),

    analyze_social_sentiment: wrapTool('analyze_social_sentiment', async ({ accounts }: { accounts: string[] }) => {
        // Pull available post content from Firestore to ground the analysis
        let recentPostSnippets: string[] = [];
        try {
            const feed = await SocialService.getFeed(undefined, 'all');
            recentPostSnippets = feed
                .slice(0, 20)
                .map((p: { content?: string }) => (p.content ?? '').slice(0, 200))
                .filter(Boolean);
        } catch (e: unknown) {
            logger.warn('[SocialTools] Could not fetch posts for sentiment context:', e);
        }

        const feedContext = recentPostSnippets.length > 0
            ? `Recent posts from the feed:\n${recentPostSnippets.slice(0, 10).map((p, i) => `${i + 1}. "${p}"`).join('\n')}`
            : 'No recent post data available — provide a general analysis for an independent music artist.';

        const prompt = `You are a professional social media analyst for the music industry.
Analyze the sentiment and trends for these accounts: ${accounts.join(', ')}.

${feedContext}

Return a JSON object with exactly these fields:
{
  "sentiment": one of "positive" | "neutral" | "negative",
  "trend_score": integer 0-100 (higher = stronger positive trend),
  "insights": array of 3-5 specific, actionable insight strings,
  "reportPeriod": "Weekly"
}
Be specific and data-driven based on the post content above.`;

        const result = await AutonomousIntelligence.generateStructuredData<{
            sentiment: string;
            trend_score: number;
            insights: string[];
            reportPeriod: string;
        }>(
            prompt,
            {
                type: 'OBJECT',
                properties: {
                    sentiment: { type: 'STRING' },
                    trend_score: { type: 'NUMBER' },
                    insights: { type: 'ARRAY', items: { type: 'STRING' } },
                    reportPeriod: { type: 'STRING' },
                },
                required: ['sentiment', 'trend_score', 'insights', 'reportPeriod'],
            } as Record<string, unknown>,
            undefined,
            undefined,
            getFineTunedModel('social')
        );

        const normalizedTrendScore = Math.min(100, Math.max(0, Math.round(result.trend_score)));

        return toolSuccess(
            { crawledAccounts: accounts, ...result, trend_score: normalizedTrendScore },
            `Weekly sentiment report for ${accounts.join(', ')}: ${result.sentiment} (score ${normalizedTrendScore}/100).`
        );
    }),

    schedule_social_post: wrapTool('schedule_social_post', async (args: { platform: string; content: string; scheduledTime: string; mediaUrls?: string[]; instagramPayload?: InstagramPublishingPayload }) => {
        try {
            const isInstagram = args.platform?.toLowerCase() === 'instagram';
            const platform: 'Twitter' | 'Instagram' | 'LinkedIn' = isInstagram ? 'Instagram' : 'Twitter';

            let scheduledTime = new Date(args.scheduledTime).getTime();
            if (!Number.isFinite(scheduledTime) || scheduledTime <= Date.now() + 60_000) {
                // Ensure safe future timestamp if in past or unparseable
                scheduledTime = Date.now() + 5 * 60_000;
            }

            const { useStore } = await import('@/core/store');
            const brandAssets = useStore.getState().userProfile?.brandKit?.brandAssets;
            let mediaUrl = args.mediaUrls?.[0];
            if (isInstagram && !mediaUrl && brandAssets?.length) {
                mediaUrl = brandAssets[brandAssets.length - 1]?.url;
            }

            let instagramPayload = args.instagramPayload;
            if (isInstagram && !instagramPayload) {
                const copy = args.content || '';
                const cleanedCaption = copy.replace(/#[\p{L}\p{N}_]+/gu, '').trim() || copy.trim();
                const extractedTags = (copy.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.replace(/^#+/, '').toLowerCase());
                const defaultTags = ['indiemusic', 'musicbusiness', 'independentartist', 'indiios'];
                const mergedTags = [...new Set([...extractedTags, ...defaultTags])].slice(0, 4);

                instagramPayload = {
                    surface: 'feed',
                    width: 1080,
                    height: 1350,
                    caption: cleanedCaption,
                    hashtags: mergedTags,
                };
            }

            const postId = await SocialService.schedulePost({
                platform,
                copy: args.content,
                day: 1, // Backward-compatible relative schedule value
                scheduledTime,
                instagramPayload,
                ...(mediaUrl ? {
                    imageAsset: {
                        assetType: 'image',
                        title: 'Auto-scheduled media',
                        imageUrl: mediaUrl,
                        caption: ''
                    }
                } : {})
            });

            return toolSuccess({
                postId,
                platform,
                scheduledTime: new Date(scheduledTime).toISOString(),
                content: args.content,
                mediaUrl,
            }, `Successfully scheduled post for ${platform} at ${new Date(scheduledTime).toLocaleTimeString()}. (ID: ${postId})`);
        } catch (e: unknown) {
            const error = e as Error;
            logger.error('[SocialTools] Failed to schedule post:', error);
            return toolError(`Failed to schedule post: ${error.message}`);
        }
    }),

    analyze_sentiment: wrapTool('analyze_sentiment', async (args: { platform: 'All' | 'X' | 'Instagram' | 'TikTok'; timeframe: '7d' | '14d' | '30d' }) => {
        return toolError(
            `Live sentiment analysis for ${args.platform} over ${args.timeframe} requires connected platform analytics/comment APIs.`,
            'SOCIAL_ANALYTICS_UNAVAILABLE'
        );
    }),

    multi_platform_autopost: wrapTool('multi_platform_autopost', async (args: {
        videoUrl: string;
        caption: string;
        hashtags?: string[];
        platforms: Array<'TikTok' | 'YouTube Shorts' | 'IG Reels'>;
        width?: number;
        height?: number;
        durationSeconds?: number;
        reelAudienceIntent?: 'discovery' | 'nurture';
    }) => {
        try {
            const { socialAutoPosterService } = await importWithRetry(() => import('@/services/marketing/SocialAutoPosterService'));
            const platformMap = {
                'TikTok': 'tiktok',
                'YouTube Shorts': 'youtube_shorts',
                'IG Reels': 'meta_reels',
            } as const;

            // allSettled, not all: a rejection on one platform must not hide the
            // platforms that already queued, or the user retries and double-posts.
            const outcomes = await Promise.allSettled(args.platforms.map(async platform => {
                const instagramPayload: InstagramPublishingPayload | undefined = platform === 'IG Reels' ? {
                    surface: 'reel',
                    width: args.width ?? 0,
                    height: args.height ?? 0,
                    durationSeconds: args.durationSeconds,
                    reelAudienceIntent: args.reelAudienceIntent,
                    caption: args.caption,
                    hashtags: args.hashtags ?? [],
                } : undefined;
                return socialAutoPosterService.queuePost({
                    id: `autopost-${crypto.randomUUID()}`,
                    mediaUrl: args.videoUrl,
                    caption: args.caption,
                    hashtags: args.hashtags || [],
                    platform: platformMap[platform],
                    instagramPayload,
                });
            }));
            const results = outcomes.map((outcome, index) => {
                const platform = args.platforms[index]!;
                return outcome.status === 'fulfilled'
                    ? { platform, status: 'queued' as const, jobId: outcome.value }
                    : {
                        platform,
                        status: 'failed' as const,
                        error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
                    };
            });
            const queued = results.filter(result => result.status === 'queued');
            const failed = results.filter(result => result.status === 'failed');
            if (failed.length > 0 && queued.length > 0) {
                return toolError(
                    `${queued.map(result => result.platform).join(', ')} already queued; do not resubmit. ` +
                    `Failed: ${failed.map(result => `${result.platform} (${(result as { error: string }).error})`).join('; ')}.`,
                    'AUTOPOST_PARTIAL_FAILURE',
                    { posts: results },
                );
            }
            if (failed.length > 0) {
                const reasons = failed.map(result => (result as { error: string }).error).join('; ');
                return toolError(`Failed to queue short-form autopost package: ${reasons}`, 'AUTOPOST_QUEUE_FAILED');
            }
            const posts = results;

            return toolSuccess({
                batchId: `autopost-${Date.now().toString(36)}`,
                posts,
            }, `Queued ${posts.length} short-form post package(s) for scheduled delivery.`);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return toolError(`Failed to queue short-form autopost package: ${msg}`, 'AUTOPOST_QUEUE_FAILED');
        }
    }),

    dispatch_community_webhook: wrapTool('dispatch_community_webhook', async (args: {
        platform: 'Discord' | 'Telegram';
        webhookUrl: string;
        messageContent: string;
        embedTitle?: string;
        embedImageUrl?: string;
        embedLink?: string;
    }) => {
        try {
            const webhook = new URL(args.webhookUrl);
            const payload = args.platform === 'Discord'
                ? {
                    content: args.messageContent,
                    embeds: args.embedTitle || args.embedImageUrl || args.embedLink ? [{
                        title: args.embedTitle,
                        image: args.embedImageUrl ? { url: args.embedImageUrl } : undefined,
                        url: args.embedLink,
                    }] : undefined,
                }
                : {
                    text: args.messageContent,
                    title: args.embedTitle,
                    imageUrl: args.embedImageUrl,
                    link: args.embedLink,
                };

            const response = await fetch(webhook.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                return toolError(`Webhook dispatch failed with HTTP ${response.status}.`, 'WEBHOOK_DISPATCH_FAILED');
            }

            return toolSuccess({
                dispatchId: `community-${Date.now().toString(36)}`,
                platform: args.platform,
                webhookHost: webhook.host,
                status: 'dispatched',
            }, `${args.platform} community announcement dispatched.`);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return toolError(`Webhook dispatch failed: ${msg}`, 'WEBHOOK_DISPATCH_FAILED');
        }
    }),

    schedule_launch_kit_rollout: wrapTool('schedule_launch_kit_rollout', async (args: {
        launchKit: unknown;
        startTimestampMs?: number;
        reelAudienceIntent?: 'discovery' | 'nurture';
    }) => {
        const parsedArgs = ScheduleLaunchKitRolloutArgsSchema.safeParse(args);
        if (!parsedArgs.success) {
            return toolError(
                `Invalid ReleaseLaunchKit rollout args: ${parsedArgs.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
                'INVALID_LAUNCH_KIT',
            );
        }

        const { launchKit: kit, startTimestampMs, reelAudienceIntent } = parsedArgs.data;
        const variantById = new Map<string, ScoredAdVariantRecord>(
            kit.adVariants.map((variant) => [variant.variantId, variant]),
        );

        interface SkippedLaunchPost {
            postId: string;
            platform: LaunchSocialPost['platform'];
            attachedVariantId: string;
            reason: string;
        }
        interface DispatchCandidate {
            post: LaunchSocialPost;
            variant?: ScoredAdVariantRecord;
        }

        const skippedPosts: SkippedLaunchPost[] = [];
        const dispatchable: DispatchCandidate[] = [];
        const videoRequiredPlatforms = new Set<LaunchSocialPost['platform']>(['TikTok', 'YouTubeShorts', 'Instagram']);

        for (const post of kit.socialPosts) {
            const variant = post.attachedVariantId ? variantById.get(post.attachedVariantId) : undefined;
            if (post.attachedVariantId) {
                if (!variant || !variant.approved || !variant.brandQcApproved || variant.discardedForRegression) {
                    skippedPosts.push({
                        postId: post.id,
                        platform: post.platform,
                        attachedVariantId: post.attachedVariantId,
                        reason: !variant
                            ? 'Referenced variant not found in launch kit.'
                            : 'Referenced variant failed approval, BrandVisionQC, or regression gate.',
                    });
                    continue;
                }
            }

            if (videoRequiredPlatforms.has(post.platform) && !variant?.renderUrl) {
                skippedPosts.push({
                    postId: post.id,
                    platform: post.platform,
                    attachedVariantId: post.attachedVariantId ?? '',
                    reason: `${post.platform} post requires an approved variant with a valid renderUrl.`,
                });
                continue;
            }

            dispatchable.push({ post, variant });
        }

        if (dispatchable.length === 0) {
            return toolError(
                'No approved launch posts remain after fail-closed ad variant verification.',
                'NO_APPROVED_POSTS',
                { kitId: kit.kitId, skippedPosts },
            );
        }

        const baseStartMs =
            typeof startTimestampMs === 'number' && startTimestampMs > Date.now() + 60_000
                ? startTimestampMs
                : Date.now() + 5 * 60_000;

        const needsAutoPoster = dispatchable.some(({ post, variant }) =>
            Boolean(variant?.renderUrl) &&
            (post.platform === 'TikTok' ||
                post.platform === 'YouTubeShorts' ||
                (post.platform === 'Instagram' && variant?.shape === '9:16')),
        );
        let autoPoster: Awaited<typeof import('@/services/marketing/SocialAutoPosterService')>['socialAutoPosterService'] | null = null;
        if (needsAutoPoster) {
            try {
                autoPoster = (await importWithRetry(() => import('@/services/marketing/SocialAutoPosterService'))).socialAutoPosterService;
            } catch (importErr: unknown) {
                const msg = importErr instanceof Error ? importErr.message : String(importErr);
                return toolError(`Failed to load SocialAutoPosterService: ${msg}`, 'LAUNCH_KIT_DISPATCH_FAILED');
            }
        }

        const autopostPlatformMap = {
            TikTok: 'tiktok',
            YouTubeShorts: 'youtube_shorts',
            Instagram: 'meta_reels',
        } as const;

        const outcomes = await Promise.allSettled(
            dispatchable.map(async ({ post, variant }) => {
                const useAutoPoster =
                    Boolean(autoPoster) &&
                    Boolean(variant?.renderUrl) &&
                    (post.platform === 'TikTok' ||
                        post.platform === 'YouTubeShorts' ||
                        (post.platform === 'Instagram' && variant?.shape === '9:16'));

                if (useAutoPoster && autoPoster && variant?.renderUrl) {
                    const targetPlatform = autopostPlatformMap[post.platform as keyof typeof autopostPlatformMap];
                    const instagramPayload: InstagramPublishingPayload | undefined =
                        post.platform === 'Instagram'
                            ? {
                                  surface: 'reel',
                                  width: 1080,
                                  height: 1920,
                                  durationSeconds: variant.durationSeconds,
                                  reelAudienceIntent,
                                  caption: post.copy,
                                  hashtags: post.hashtags,
                              }
                            : undefined;

                    const jobId = await autoPoster.queuePost({
                        id: `${kit.kitId}-${post.id}`,
                        mediaUrl: variant.renderUrl,
                        caption: post.copy,
                        hashtags: post.hashtags,
                        platform: targetPlatform,
                        instagramPayload,
                    });
                    return {
                        postId: post.id,
                        platform: post.platform,
                        route: 'autopost' as const,
                        status: 'queued' as const,
                        jobId,
                    };
                }

                const schedulePlatform: 'Twitter' | 'Instagram' =
                    post.platform === 'Instagram' || post.platform === 'InstagramStory'
                        ? 'Instagram'
                        : 'Twitter';
                const scheduledTime = Math.min(
                    MAX_SAFE_SCHEDULE_TIMESTAMP_MS + 90 * 86_400_000,
                    baseStartMs + post.scheduledDayOffset * 86_400_000,
                );
                const postId = await SocialService.schedulePost({
                    platform: schedulePlatform,
                    copy: post.copy,
                    day: post.scheduledDayOffset + 1,
                    scheduledTime,
                    ...(variant?.renderUrl
                        ? {
                              imageAsset: {
                                  assetType: 'image' as const,
                                  title: `${kit.title} (${post.platform})`,
                                  imageUrl: variant.renderUrl,
                                  caption: post.copy,
                              },
                          }
                        : {}),
                });
                return {
                    postId: post.id,
                    platform: post.platform,
                    route: 'schedule' as const,
                    status: 'scheduled' as const,
                    jobId: postId,
                    scheduledTime: new Date(scheduledTime).toISOString(),
                };
            }),
        );

        const results = outcomes.map((outcome, index) => {
            const candidate = dispatchable[index]!;
            if (outcome.status === 'fulfilled') {
                return outcome.value;
            }
            return {
                postId: candidate.post.id,
                platform: candidate.post.platform,
                status: 'failed' as const,
                error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
            };
        });

        const succeeded = results.filter((r) => r.status !== 'failed');
        const failed = results.filter((r) => r.status === 'failed');

        if (failed.length > 0 && succeeded.length > 0) {
            return toolError(
                `${succeeded.map((r) => r.platform).join(', ')} already queued; do not resubmit. ` +
                    `Failed: ${failed.map((r) => `${r.platform} (${'error' in r ? r.error : 'unknown error'})`).join('; ')}.`,
                'LAUNCH_KIT_PARTIAL_FAILURE',
                { kitId: kit.kitId, dispatched: results, skippedPosts },
            );
        }

        if (failed.length > 0) {
            return toolError(
                `Failed to schedule launch kit rollout: ${failed.map((r) => ('error' in r ? r.error : 'unknown error')).join('; ')}`,
                'LAUNCH_KIT_DISPATCH_FAILED',
                { kitId: kit.kitId, dispatched: results, skippedPosts },
            );
        }

        return toolSuccess(
            { kitId: kit.kitId, dispatched: results, skippedPosts },
            `Scheduled ${succeeded.length} ReleaseLaunchKit post(s) across channels (${skippedPosts.length} skipped).`,
        );
    })
} satisfies Record<string, AnyToolFunction>;

// Aliases
export const {
    generate_social_post,
    analyze_social_sentiment,
    schedule_social_post,
    analyze_sentiment,
    multi_platform_autopost,
    dispatch_community_webhook,
    schedule_launch_kit_rollout
} = SocialTools;
