import { AI } from '@/services/ai/AIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { useStore } from '@/core/store';
import {
    CampaignBrief,
    GeneratedCampaignPlan,
    PostEnhancement,
    EngagementPrediction,
    ScheduledPost,
    CampaignAsset,
    CampaignStatus,
    BatchImageProgress,
    EnhancementType,
    Platform
} from '@/modules/marketing/types';
import { AppException, AppErrorCode } from '@/shared/types/errors';

/**
 * CampaignAIService - AI-powered campaign features
 *
 * Following patterns from:
 * - EditingService.ts (singleton, batch processing, progress callbacks)
 * - PostGenerator.tsx (AI.generateStructuredData, brand context injection)
 *
 * Features:
 * 1. generateCampaign() - Generate full campaign from a brief
 * 2. enhancePostCopy() - Rewrite/improve existing post copy
 * 3. generatePostImages() - Batch generate images with progress
 * 4. predictEngagement() - Predict campaign performance
 */
export class CampaignAIService {

    // =========================================================================
    // 1. AI CAMPAIGN GENERATION
    // =========================================================================

    /**
     * Generate a complete campaign plan from a brief
     * Uses gemini-3-pro-preview for complex reasoning
     */
    async generateCampaign(brief: CampaignBrief): Promise<GeneratedCampaignPlan> {
        const brandContext = this.getBrandContext();

        const prompt = `
You are an expert social media campaign strategist for music artists and creative brands.

BRAND CONTEXT:
${brandContext}

CAMPAIGN BRIEF:
- Topic: ${brief.topic}
- Objective: ${brief.objective}
- Platforms: ${brief.platforms.join(', ')}
- Duration: ${brief.durationDays} days
- Posts per day: ${brief.postsPerDay}
- Tone: ${brief.tone}
${brief.targetAudience ? `- Target Audience: ${brief.targetAudience}` : ''}

TASK:
Generate a complete campaign plan with posts distributed across the duration.
Each post should have platform-specific copy optimized for that platform's best practices.
Include relevant hashtags and a detailed image prompt for visual generation.
Consider optimal posting times and engagement patterns.

PLATFORM GUIDELINES:
- Twitter: Punchy, conversation-starting, max 280 chars, 2-3 hashtags
- Instagram: Story-driven, visual-first, up to 2200 chars, 10-15 hashtags
- LinkedIn: Professional, value-driven, industry insights, 3-5 hashtags

Total posts needed: ${brief.durationDays * brief.postsPerDay}
`;

        const schema = {
            nullable: false,
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Campaign title' },
                description: { type: 'string', description: 'Campaign description and strategy overview' },
                posts: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            platform: { type: 'string', enum: ['Twitter', 'Instagram', 'LinkedIn'] },
                            day: { type: 'number', description: 'Day number (1-indexed)' },
                            copy: { type: 'string', description: 'Full post text' },
                            imagePrompt: { type: 'string', description: 'Detailed prompt for image generation' },
                            hashtags: { type: 'array', items: { type: 'string' } },
                            bestTimeToPost: { type: 'string', description: 'Suggested posting time (e.g., "9:00 AM EST")' }
                        },
                        required: ['platform', 'day', 'copy', 'imagePrompt', 'hashtags']
                    }
                }
            },
            required: ['title', 'description', 'posts']
        };

        // E2E Test Mock Bypass
        // @ts-expect-error - injected by Playwright
        if (import.meta.env.DEV && window.__MOCK_AI_PLAN__) {
            console.log('[CampaignAIService] Using MOCK AI Plan');
            // @ts-expect-error - injected by Playwright
            return window.__MOCK_AI_PLAN__;
        }

        try {
            const result = await AI.generateStructuredData<GeneratedCampaignPlan>(prompt, schema as any);

            // Validate and clean up the result
            return {
                title: result.title || `${brief.topic} Campaign`,
                description: result.description || '',
                posts: Array.isArray(result.posts) ? result.posts : []
            };
        } catch (error) {
            throw new Error('Failed to generate campaign. Please try again.');
        }
    }

    /**
     * Convert generated plan to CampaignAsset format ready for persistence
     */
    planToCampaignAsset(plan: GeneratedCampaignPlan, startDate: string): CampaignAsset {
        const posts: ScheduledPost[] = plan.posts.map((p, index) => ({
            id: `post_${Date.now()}_${index}`,
            platform: p.platform as Platform,
            copy: p.copy + '\n\n' + p.hashtags.join(' '),
            imageAsset: {
                assetType: 'image' as const,
                title: `${plan.title} - Day ${p.day}`,
                imageUrl: '', // To be generated via generatePostImages
                caption: p.imagePrompt
            },
            day: p.day,
            status: CampaignStatus.PENDING
        }));

        const durationDays = plan.posts.length > 0
            ? Math.max(...plan.posts.map(p => p.day))
            : 7;

        return {
            assetType: 'campaign',
            title: plan.title,
            description: plan.description,
            durationDays,
            startDate,
            posts,
            status: CampaignStatus.PENDING
        };
    }

    // =========================================================================
    // 2. AI POST ENHANCEMENT
    // =========================================================================

    /**
     * Enhance/rewrite existing post copy
     */
    async enhancePostCopy(
        post: ScheduledPost,
        enhancementType: EnhancementType
    ): Promise<PostEnhancement> {
        const brandContext = this.getBrandContext();

        const instructions: Record<EnhancementType, string> = {
            improve: 'Make this copy more engaging, impactful, and likely to drive engagement while preserving the core message.',
            shorter: 'Create a more concise version that fits platform character limits better while maintaining impact.',
            longer: 'Expand this copy with more detail, storytelling, and context while keeping it engaging and on-brand.',
            different_tone: 'Rewrite with a fresh perspective and different emotional approach while keeping the core message.'
        };

        const platformLimits: Record<Platform, number> = {
            Twitter: 280,
            Instagram: 2200,
            LinkedIn: 3000
        };

        const prompt = `
You are an expert social media copywriter for music artists and creative brands.

BRAND CONTEXT:
${brandContext}

PLATFORM: ${post.platform}
CHARACTER LIMIT: ${platformLimits[post.platform]}

ORIGINAL POST:
"${post.copy}"

ENHANCEMENT TASK: ${instructions[enhancementType]}

Provide:
1. An enhanced version of the copy
2. Two alternative versions with different approaches
3. Suggested hashtags that are relevant and trending
4. A brief analysis of the tone and emotional appeal

Ensure all versions respect the platform's character limit.
`;

        const schema = {
            nullable: false,
            type: 'object',
            properties: {
                enhancedCopy: { type: 'string', description: 'Primary enhanced version' },
                alternativeVersions: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Two alternative versions'
                },
                suggestedHashtags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Relevant hashtags'
                },
                toneAnalysis: { type: 'string', description: 'Brief tone and appeal analysis' }
            },
            required: ['enhancedCopy', 'alternativeVersions', 'suggestedHashtags', 'toneAnalysis']
        };

        try {
            const result = await AI.generateStructuredData<PostEnhancement>(prompt, schema as any);

            return {
                enhancedCopy: result.enhancedCopy || post.copy,
                alternativeVersions: Array.isArray(result.alternativeVersions) ? result.alternativeVersions : [],
                suggestedHashtags: Array.isArray(result.suggestedHashtags) ? result.suggestedHashtags : [],
                toneAnalysis: result.toneAnalysis || ''
            };
        } catch (error) {
            throw new Error('Failed to enhance post copy. Please try again.');
        }
    }

    // =========================================================================
    // 3. AI IMAGE GENERATION (Batch with Progress)
    // =========================================================================

    /**
     * Generate images for posts missing visuals
     * Sequential processing to avoid rate limits (following EditingService pattern)
     */
    async generatePostImages(
        posts: ScheduledPost[],
        onProgress?: (progress: BatchImageProgress) => void
    ): Promise<ScheduledPost[]> {
        const postsNeedingImages = posts.filter(p => !p.imageAsset.imageUrl);
        const total = postsNeedingImages.length;

        if (total === 0) {
            return posts;
        }

        const updatedPosts = new Map<string, ScheduledPost>();

        // Process sequentially to avoid rate limits
        for (let i = 0; i < total; i++) {
            const post = postsNeedingImages[i];

            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total,
                    currentPostId: post.id,
                    status: 'generating'
                });
            }

            try {
                // Use image prompt from caption or generate one
                const imagePrompt = post.imageAsset.caption
                    ? this.enhanceImagePrompt(post.imageAsset.caption)
                    : await this.generateImagePromptFromCopy(post.copy, post.platform);

                const base64 = await AI.generateImage({
                    model: AI_MODELS.IMAGE.GENERATION,
                    prompt: imagePrompt
                });

                updatedPosts.set(post.id, {
                    ...post,
                    imageAsset: {
                        ...post.imageAsset,
                        imageUrl: `data:image/png;base64,${base64}`
                    }
                });

            } catch (error) {
                // Continue with other posts, don't fail the whole batch
            }
        }

        if (onProgress) {
            onProgress({
                current: total,
                total,
                currentPostId: postsNeedingImages[total - 1]?.id || '',
                status: 'complete'
            });
        }

        // Return all posts with updated ones merged in
        return posts.map(post => updatedPosts.get(post.id) || post);
    }

    /**
     * Generate a single image for a post
     */
    async generateSingleImage(post: ScheduledPost): Promise<string | null> {
        try {
            const imagePrompt = post.imageAsset.caption
                ? this.enhanceImagePrompt(post.imageAsset.caption)
                : await this.generateImagePromptFromCopy(post.copy, post.platform);

            const base64 = await AI.generateImage({
                model: AI_MODELS.IMAGE.GENERATION,
                prompt: imagePrompt
            });

            return `data:image/png;base64,${base64}`;
        } catch (error) {
            return null;
        }
    }

    /**
     * Generate an image prompt from post copy
     */
    private async generateImagePromptFromCopy(copy: string, platform: Platform): Promise<string> {
        const brandContext = this.getBrandContext();

        const prompt = `
Generate a detailed image prompt for a ${platform} post visual.

BRAND CONTEXT:
${brandContext}

POST COPY:
"${copy}"

Create a vivid, specific image prompt that would work well as a social media visual.
Focus on mood, colors, composition, and brand alignment.
The image should complement and enhance the post's message.

Return ONLY the image prompt, no explanation or formatting.
`;

        try {
            return await AI.generateText(prompt);
        } catch (error) {
            return `Modern, visually striking social media graphic for ${platform}`;
        }
    }

    /**
     * Enhance image prompt with brand context
     */
    private enhanceImagePrompt(prompt: string): string {
        const userProfile = useStore.getState().userProfile;
        const brandKit = userProfile?.brandKit;

        let enhanced = prompt;

        if (brandKit?.aestheticStyle) {
            enhanced += ` Style: ${brandKit.aestheticStyle}.`;
        }
        if (brandKit?.colors && brandKit.colors.length > 0) {
            enhanced += ` Color palette: ${brandKit.colors.slice(0, 3).join(', ')}.`;
        }
        if (brandKit?.negativePrompt) {
            enhanced += ` Avoid: ${brandKit.negativePrompt}.`;
        }

        return enhanced;
    }

    // =========================================================================
    // 4. AI PERFORMANCE PREDICTION
    // =========================================================================

    /**
     * Predict engagement metrics for a campaign
     */
    async predictEngagement(campaign: CampaignAsset): Promise<EngagementPrediction> {
        const brandContext = this.getBrandContext();

        const postsAnalysis = campaign.posts.slice(0, 10).map(p => ({
            platform: p.platform,
            day: p.day,
            copyLength: p.copy.length,
            hasImage: !!p.imageAsset.imageUrl,
            copyPreview: p.copy.substring(0, 150)
        }));

        const platformMix = this.getPlatformMix(campaign.posts);

        const prompt = `
You are a social media analytics expert with deep knowledge of platform algorithms and engagement patterns.

BRAND CONTEXT:
${brandContext}

CAMPAIGN DETAILS:
- Title: ${campaign.title}
- Description: ${campaign.description || 'N/A'}
- Duration: ${campaign.durationDays} days
- Total Posts: ${campaign.posts.length}
- Platform Distribution: ${platformMix}
- Posts with Images: ${campaign.posts.filter(p => p.imageAsset.imageUrl).length}/${campaign.posts.length}

SAMPLE POSTS (first 10):
${JSON.stringify(postsAnalysis, null, 2)}

TASK:
Predict the engagement performance of this campaign and provide actionable recommendations.

Consider:
- Posting frequency and timing
- Content quality and variety
- Platform-specific best practices
- Visual content presence
- Hashtag usage
- Audience engagement patterns

Provide realistic estimates based on typical engagement rates:
- Twitter: 1-3% engagement rate
- Instagram: 3-6% engagement rate
- LinkedIn: 2-4% engagement rate

Base reach estimates on a modest following of 5,000-10,000 combined followers.
`;

        const schema = {
            nullable: false,
            type: 'object',
            properties: {
                overallScore: {
                    type: 'number',
                    description: 'Overall campaign quality score (0-100)'
                },
                estimatedReach: {
                    type: 'number',
                    description: 'Estimated total reach across all posts'
                },
                estimatedEngagementRate: {
                    type: 'number',
                    description: 'Estimated average engagement rate (percentage)'
                },
                platformBreakdown: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            platform: { type: 'string' },
                            predictedLikes: { type: 'number' },
                            predictedComments: { type: 'number' },
                            predictedShares: { type: 'number' },
                            confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
                        },
                        required: ['platform', 'predictedLikes', 'predictedComments', 'predictedShares', 'confidence']
                    }
                },
                recommendations: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Actionable recommendations to improve performance'
                },
                riskFactors: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Potential risks or issues with the campaign'
                }
            },
            required: ['overallScore', 'estimatedReach', 'estimatedEngagementRate',
                'platformBreakdown', 'recommendations', 'riskFactors']
        };

        try {
            const result = await AI.generateStructuredData<EngagementPrediction>(prompt, schema as any);

            return {
                overallScore: result.overallScore || 50,
                estimatedReach: result.estimatedReach || 0,
                estimatedEngagementRate: result.estimatedEngagementRate || 0,
                platformBreakdown: Array.isArray(result.platformBreakdown) ? result.platformBreakdown : [],
                recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
                riskFactors: Array.isArray(result.riskFactors) ? result.riskFactors : []
            };
        } catch (error) {
            throw new Error('Failed to predict engagement. Please try again.');
        }
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    /**
     * Build brand context string from user profile
     * (Following PostGenerator.tsx pattern)
     */
    private getBrandContext(): string {
        const userProfile = useStore.getState().userProfile;
        const brand = userProfile?.brandKit;

        if (!brand) return 'No brand kit available. Use general best practices.';

        const parts: string[] = [];

        if (userProfile?.displayName) {
            parts.push(`Brand Name: ${userProfile.displayName}`);
        }
        if (brand.brandDescription) {
            parts.push(`Brand Description: ${brand.brandDescription}`);
        }
        if (brand.releaseDetails?.title) {
            parts.push(`Current Release: ${brand.releaseDetails.title} (${brand.releaseDetails.type})`);
        }
        if (brand.releaseDetails?.mood) {
            parts.push(`Mood: ${brand.releaseDetails.mood}`);
        }
        if (brand.releaseDetails?.themes) {
            parts.push(`Themes: ${brand.releaseDetails.themes}`);
        }
        if (brand.releaseDetails?.genre) {
            parts.push(`Genre: ${brand.releaseDetails.genre}`);
        }
        if (brand.aestheticStyle) {
            parts.push(`Visual Style: ${brand.aestheticStyle}`);
        }

        return parts.length > 0 ? parts.join('\n') : 'No brand kit available. Use general best practices.';
    }

    /**
     * Get platform distribution as string
     */
    private getPlatformMix(posts: ScheduledPost[]): string {
        const counts: Record<string, number> = {};
        posts.forEach(p => {
            counts[p.platform] = (counts[p.platform] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([platform, count]) => `${platform}: ${count}`)
            .join(', ') || 'None';
    }
}

// Singleton export (following EditingService pattern)
export const CampaignAI = new CampaignAIService();
