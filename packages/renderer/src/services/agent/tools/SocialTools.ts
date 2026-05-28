import { AutonomousIntelligence, getResponseText } from '@/services/intelligence/AutonomousIntelligence';
import { SocialService } from '@/services/social/SocialService';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

// ============================================================================
// SocialTools Implementation
// ============================================================================

export const SocialTools = {
    generate_social_post: wrapTool('generate_social_post', async ({ platform, topic, tone }: { platform: string; topic: string; tone?: string }) => {
        const prompt = `Generate a ${tone || 'professional'} social media post for ${platform} about ${topic}. Include hashtags.`;

        const result = await AutonomousIntelligence.generateContent(
            prompt,
            INTELLIGENCE_MODELS.TEXT.AGENT
        );
        const text = getResponseText(result);

        // Auto-persist using the robust SocialService
        let postId: string | null = null;
        let persistMessage = "Post generated but failed to save to feed.";

        try {
            postId = await SocialService.createPost(text);
            persistMessage = `Saved to Feed (ID: ${postId})`;
        } catch (persistError: unknown) {
            logger.warn('Failed to persist social post:', persistError);
        }

        return toolSuccess({
            platform,
            content: text,
            postId
        }, `Generated Post for ${platform}:\n${text}\n\n${persistMessage}`);
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
            INTELLIGENCE_MODELS.TEXT.AGENT
        );

        const normalizedTrendScore = Math.min(100, Math.max(0, Math.round(result.trend_score)));

        return toolSuccess(
            { crawledAccounts: accounts, ...result, trend_score: normalizedTrendScore },
            `Weekly sentiment report for ${accounts.join(', ')}: ${result.sentiment} (score ${normalizedTrendScore}/100).`
        );
    }),

    schedule_social_post: wrapTool('schedule_social_post', async (args: { platform: string; content: string; scheduledTime: string; mediaUrls?: string[] }) => {
        try {
            const postId = await SocialService.schedulePost({
                platform: args.platform as 'Twitter' | 'Instagram' | 'LinkedIn',
                copy: args.content,
                day: 0, // Fallback for relative schedule
                scheduledTime: new Date(args.scheduledTime).getTime(),
                ...(args.mediaUrls?.length ? {
                    imageAsset: {
                        assetType: 'image',
                        title: 'Auto-scheduled media',
                        imageUrl: args.mediaUrls[0] || '',
                        caption: ''
                    }
                } : {})
            });

            return toolSuccess({
                postId,
                ...args
            }, `Successfully scheduled post for ${args.platform} at ${args.scheduledTime}. (ID: ${postId})`);
        } catch (e: unknown) {
            const error = e as Error;
            logger.error('[SocialTools] Failed to schedule post:', error);
            return toolError(`Failed to schedule post: ${error.message}`);
        }
    }),

    analyze_sentiment: wrapTool('analyze_sentiment', async (args: { platform: 'All' | 'X' | 'Instagram' | 'TikTok'; timeframe: '7d' | '14d' | '30d' }) => {
        const platforms = args.platform === 'All'
            ? ['X', 'Instagram', 'TikTok']
            : [args.platform];

        return toolSuccess({
            platforms,
            timeframe: args.timeframe,
            sentiment: 'neutral',
            trend_score: 50,
            insights: [
                'No live social account data was pulled in this execution.',
                'Connect platform APIs to replace this baseline with account-level sentiment.',
                'Use recent comments, saves, shares, and completion rate as the primary signal set.',
            ],
            reportPeriod: args.timeframe,
        }, `Baseline sentiment report prepared for ${platforms.join(', ')} over ${args.timeframe}.`);
    }),

    multi_platform_autopost: wrapTool('multi_platform_autopost', async (args: {
        videoUrl: string;
        caption: string;
        hashtags?: string[];
        platforms: Array<'TikTok' | 'YouTube Shorts' | 'IG Reels'>;
    }) => {
        const posts = args.platforms.map(platform => ({
            platform,
            status: 'queued_for_provider',
            caption: args.caption,
            hashtags: args.hashtags || [],
            videoUrl: args.videoUrl,
        }));

        return toolSuccess({
            batchId: `autopost-${Date.now().toString(36)}`,
            posts,
            note: 'Posts are queued for provider handoff. Live native posting requires connected platform credentials.',
        }, `Queued ${posts.length} short-form post package(s).`);
    }),

    dispatch_community_webhook: wrapTool('dispatch_community_webhook', async (args: {
        platform: 'Discord' | 'Telegram';
        webhookUrl: string;
        messageContent: string;
        embedTitle?: string;
        embedImageUrl?: string;
        embedLink?: string;
    }) => {
        return toolSuccess({
            dispatchId: `community-${Date.now().toString(36)}`,
            platform: args.platform,
            webhookConfigured: Boolean(args.webhookUrl),
            webhookHost: (() => {
                try {
                    return new URL(args.webhookUrl).host;
                } catch {
                    return 'invalid-url';
                }
            })(),
            payload: {
                messageContent: args.messageContent,
                embedTitle: args.embedTitle || null,
                embedImageUrl: args.embedImageUrl || null,
                embedLink: args.embedLink || null,
            },
            status: 'prepared_for_webhook_dispatch',
            note: 'Webhook payload is prepared without exposing or calling the raw webhook URL from the agent loop.',
        }, `${args.platform} community announcement prepared.`);
    })
} satisfies Record<string, AnyToolFunction>;

// Aliases
export const {
    generate_social_post,
    analyze_social_sentiment,
    schedule_social_post,
    analyze_sentiment,
    multi_platform_autopost,
    dispatch_community_webhook
} = SocialTools;
