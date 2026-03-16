import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { SocialService } from '@/services/social/SocialService';
import { AI_MODELS } from '@/core/config/ai-models';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

// ============================================================================
// SocialTools Implementation
// ============================================================================

export const SocialTools: Record<string, AnyToolFunction> = {
    generate_social_post: wrapTool('generate_social_post', async ({ platform, topic, tone }: { platform: string; topic: string; tone?: string }) => {
        const prompt = `Generate a ${tone || 'professional'} social media post for ${platform} about ${topic}. Include hashtags.`;

        const result = await firebaseAI.generateContent(
            prompt,
            AI_MODELS.TEXT.AGENT
        );
        const text = result.response.text();

        // Auto-persist using the robust SocialService
        let postId: string | null = null;
        let persistMessage = "Post generated but failed to save to feed.";

        try {
            postId = await SocialService.createPost(text);
            persistMessage = `Saved to Feed (ID: ${postId})`;
        } catch (persistError) {
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
        } catch (e) {
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

        const result = await firebaseAI.generateStructuredData<{
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
            AI_MODELS.TEXT.AGENT
        );

        const normalizedTrendScore = Math.min(100, Math.max(0, Math.round(result.trend_score)));

        return toolSuccess(
            { crawledAccounts: accounts, ...result, trend_score: normalizedTrendScore },
            `Weekly sentiment report for ${accounts.join(', ')}: ${result.sentiment} (score ${normalizedTrendScore}/100).`
        );
    })
};

// Aliases
export const { generate_social_post, analyze_social_sentiment } = SocialTools;
