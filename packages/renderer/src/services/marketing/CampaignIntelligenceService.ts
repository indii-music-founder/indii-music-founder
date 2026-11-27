import { AutonomousIntelligence as GenAI } from '@/services/intelligence/AutonomousIntelligence';
import { VideoGeneration } from '@/services/video/VideoGenerationService';
import { INTELLIGENCE_MODELS } from '@/core/config/intelligence-models';

export type MarketingImageModelTier = 'fast' | 'pro' | 'imagen-fast' | 'imagen-pro';

const MARKETING_IMAGE_MODEL_MAP: Record<MarketingImageModelTier, string> = {
    fast: INTELLIGENCE_MODELS.IMAGE.FAST,
    pro: INTELLIGENCE_MODELS.IMAGE.GENERATION,
    'imagen-fast': INTELLIGENCE_MODELS.IMAGE.IMAGEN_FAST,
    'imagen-pro': INTELLIGENCE_MODELS.IMAGE.IMAGEN_PRO,
};

/**
 * Resolve a marketing image model tier to its policy-approved model identifier.
 */
export function resolveMarketingImageModel(tier: MarketingImageModelTier = 'pro'): string {
    return MARKETING_IMAGE_MODEL_MAP[tier];
}
import { CreativeStorageService } from '@/services/creative/CreativeStorageService';
import { auth, storage } from '@/services/firebase';
import { getDownloadURL, ref } from 'firebase/storage';
// useStore removed
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
import {
    ReleaseLaunchKitSchema,
    type ReleaseLaunchKit,
    type LaunchSocialPost,
    type ScoredAdVariantRecord,
    type LaunchHookWindow,
} from '@indii/shared';

export interface ReleaseLaunchKitBrief {
    kitId?: string;
    title: string;
    artistOrBrandName: string;
    topic: string;
    objective?: string;
    tone?: string;
    canonicalRecordingEntityId?: string;
    canonicalMasterStoragePath?: string;
    measuredBpm?: number;
    hookWindows?: LaunchHookWindow[];
    lockedReferenceImageUris?: string[];
    lockedSeed?: number;
    smartLinkUrl?: string;
    fullMusicVideoProjectId?: string;
    adVariants?: ScoredAdVariantRecord[];
    campaignSlug?: string;
}

const UTM_SOURCE_MAP: Record<LaunchSocialPost['platform'], string> = {
    Instagram: 'instagram',
    InstagramStory: 'instagram_story',
    TikTok: 'tiktok',
    YouTubeShorts: 'youtube_shorts',
    X: 'x',
    XHeader: 'x_header',
};

const PLATFORM_PREFERRED_SHAPES: Record<LaunchSocialPost['platform'], Array<ScoredAdVariantRecord['shape']>> = {
    Instagram: ['9:16'],
    InstagramStory: ['9:16'],
    TikTok: ['9:16'],
    YouTubeShorts: ['9:16', '16:9'],
    X: ['1:1', '4:5', '16:9'],
    XHeader: [],
};

/**
 * Append channel-specific UTM attribution parameters to a SmartLink URL while
 * preserving existing query parameters and failing soft on invalid URLs.
 */
export function attachSmartLinkAttribution(
    smartLinkUrl: string,
    platform: LaunchSocialPost['platform'],
    campaignSlug: string,
): string {
    if (!smartLinkUrl || !smartLinkUrl.trim()) {
        return smartLinkUrl;
    }
    try {
        const parsed = new URL(smartLinkUrl);
        const normalizedSlug =
            campaignSlug
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || 'indii-launch';
        parsed.searchParams.set('utm_source', UTM_SOURCE_MAP[platform]);
        parsed.searchParams.set('utm_medium', 'social');
        parsed.searchParams.set('utm_campaign', normalizedSlug);
        return parsed.toString();
    } catch {
        return smartLinkUrl;
    }
}

/**
 * CampaignIntelligenceService - Intelligence-driven campaign features
 *
 * Following patterns from:
 * - EditingService.ts (singleton, batch processing, progress callbacks)
 * - PostGenerator.tsx (Intelligence.generateStructuredData, brand context injection)
 *
 * Features:
 * 1. generateCampaign() - Generate full campaign from a brief
 * 2. enhancePostCopy() - Rewrite/improve existing post copy
 * 3. generatePostImages() - Batch generate images with progress
 * 4. predictEngagement() - Predict campaign performance
 */
export class CampaignIntelligenceService {

    // =========================================================================
    // 1. INTELLIGENCE CAMPAIGN GENERATION
    // =========================================================================

    /**
     * Generate a complete campaign plan from a brief
     * Uses Gemini 4 Neon for complex reasoning
     */
    async generateCampaign(brief: CampaignBrief): Promise<GeneratedCampaignPlan> {
        const brandContext = await this.getBrandContext();

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
- Email: Compelling subject line, personalized body, call-to-action focus

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
                            platform: { type: 'string', enum: ['Twitter', 'Instagram', 'LinkedIn', 'Email'] },
                            day: { type: 'number', description: 'Day number (1-indexed)' },
                            subject: { type: 'string', description: 'Email subject line (Email only)' },
                            copy: { type: 'string', description: 'Full post text or email body' },
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

        try {
            const result = await GenAI.generateStructuredData<GeneratedCampaignPlan>(prompt, schema);

            // Validate and clean up the result
            return {
                title: result.title || `${brief.topic} Campaign`,
                description: result.description || '',
                posts: Array.isArray(result.posts) ? result.posts : []
            };
        } catch (_error: unknown) {
            throw new Error('Failed to generate campaign. Please try again.');
        }
    }

    /**
     * Generate a schema-validated ReleaseLaunchKit binding canonical audio/visual
     * assets, approved multi-shape ad cuts, and UTM-attributed social posts.
     */
    async generateReleaseLaunchKit(brief: ReleaseLaunchKitBrief): Promise<ReleaseLaunchKit> {
        const brandContext = await this.getBrandContext();
        const campaignSlug = brief.campaignSlug || brief.title || brief.topic;
        const hookSummary = (brief.hookWindows ?? [])
            .map((h) => `${h.section} (${h.startTimeSeconds}s-${h.endTimeSeconds}s, ${h.energyLevel})${h.lyricSnippet ? `: "${h.lyricSnippet}"` : ''}`)
            .join('\n');

        const prompt = `
You are an expert omnichannel release strategist for music artists and creative brands.

BRAND CONTEXT:
${brandContext}

RELEASE LAUNCH KIT BRIEF:
- Title: ${brief.title}
- Artist / Brand: ${brief.artistOrBrandName}
- Topic: ${brief.topic}
- Objective: ${brief.objective || 'Maximize release-week discovery, pre-saves, and video views'}
- Tone: ${brief.tone || 'High-impact, authentic, fan-first'}
${brief.measuredBpm ? `- Tempo: ${brief.measuredBpm} BPM` : ''}
${brief.smartLinkUrl ? `- SmartLink URL: ${brief.smartLinkUrl}` : ''}
${hookSummary ? `- Audio Hooks:\n${hookSummary}` : ''}

TASK:
Generate coordinated launch posts across Instagram, InstagramStory, TikTok, YouTubeShorts, X, and XHeader.
Keep X copy punchy (under 240 chars so attribution links fit cleanly). For Instagram Reels, supply 5–8 specific, unique hashtags in the hashtags field and keep hashtags out of the caption. Include relevant hashtags for TikTok/Shorts/X.
`;

        const schema = {
            nullable: false,
            type: 'object',
            properties: {
                posts: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            platform: {
                                type: 'string',
                                enum: ['Instagram', 'InstagramStory', 'TikTok', 'YouTubeShorts', 'X', 'XHeader'],
                            },
                            copy: { type: 'string' },
                            hashtags: { type: 'array', items: { type: 'string' } },
                            scheduledDayOffset: { type: 'number' },
                        },
                        required: ['platform', 'copy', 'hashtags', 'scheduledDayOffset'],
                    },
                },
            },
            required: ['posts'],
        };

        interface RawLaunchPostDraft {
            platform: LaunchSocialPost['platform'];
            copy: string;
            hashtags?: string[];
            scheduledDayOffset?: number;
        }

        const aiResult = await GenAI.generateStructuredData<{ posts: RawLaunchPostDraft[] }>(prompt, schema);
        const rawPosts = Array.isArray(aiResult?.posts) ? aiResult.posts : [];

        const approvedVariants = (brief.adVariants ?? []).filter(
            (v) => v.approved && v.brandQcApproved && !v.discardedForRegression,
        );

        const socialPosts: LaunchSocialPost[] = rawPosts.map((draft, index) => {
            const attachedVariant = this.selectApprovedVariantForPlatform(draft.platform, approvedVariants);
            const copy = this.formatLaunchPostCopy(draft.platform, draft.copy || brief.title, brief.smartLinkUrl, campaignSlug);
            const dayOffset = Number.isFinite(draft.scheduledDayOffset)
                ? Math.min(90, Math.max(0, Math.round(draft.scheduledDayOffset as number)))
                : 0;
            const hashtags = Array.isArray(draft.hashtags)
                ? draft.hashtags.map((h) => String(h).slice(0, 64)).slice(0, 30)
                : [];

            return {
                id: `${brief.kitId || 'kit'}-post-${index + 1}`,
                platform: draft.platform,
                copy,
                hashtags,
                ...(attachedVariant ? { attachedVariantId: attachedVariant.variantId } : {}),
                scheduledDayOffset: dayOffset,
                status: attachedVariant || draft.platform === 'XHeader' ? 'approved' : 'draft',
            };
        });

        return ReleaseLaunchKitSchema.parse({
            kitId: brief.kitId || `kit-${Date.now().toString(36)}`,
            title: brief.title,
            artistOrBrandName: brief.artistOrBrandName,
            ...(brief.canonicalRecordingEntityId ? { canonicalRecordingEntityId: brief.canonicalRecordingEntityId } : {}),
            ...(brief.canonicalMasterStoragePath ? { canonicalMasterStoragePath: brief.canonicalMasterStoragePath } : {}),
            ...(brief.measuredBpm ? { measuredBpm: brief.measuredBpm } : {}),
            hookWindows: brief.hookWindows ?? [],
            lockedReferenceImageUris: brief.lockedReferenceImageUris ?? [],
            ...(brief.lockedSeed !== undefined ? { lockedSeed: brief.lockedSeed } : {}),
            ...(brief.smartLinkUrl ? { smartLinkUrl: brief.smartLinkUrl } : {}),
            ...(brief.fullMusicVideoProjectId ? { fullMusicVideoProjectId: brief.fullMusicVideoProjectId } : {}),
            adVariants: brief.adVariants ?? [],
            socialPosts,
            createdAtIso: new Date().toISOString(),
        });
    }

    private selectApprovedVariantForPlatform(
        platform: LaunchSocialPost['platform'],
        approvedVariants: ScoredAdVariantRecord[],
    ): ScoredAdVariantRecord | undefined {
        const preferredShapes = PLATFORM_PREFERRED_SHAPES[platform];
        const isInstagramVideo = platform === 'Instagram' || platform === 'InstagramStory';
        const publishableCuts = isInstagramVideo
            ? approvedVariants.filter(variant => variant.renderUrl?.startsWith('https://')
                && (platform === 'Instagram' ? variant.durationSeconds < 15 : variant.durationSeconds <= 15))
            : approvedVariants;
        for (const shape of preferredShapes) {
            const candidates = publishableCuts
                .filter((v) => v.shape === shape)
                .sort((a, b) => b.overallScore - a.overallScore);
            if (candidates.length > 0) {
                return candidates[0];
            }
        }
        return undefined;
    }

    private formatLaunchPostCopy(
        platform: LaunchSocialPost['platform'],
        rawCopy: string,
        smartLinkUrl: string | undefined,
        campaignSlug: string,
    ): string {
        const trimmed = rawCopy.trim();
        if (platform === 'XHeader' || !smartLinkUrl) {
            return platform === 'X' ? trimmed.slice(0, 280) : trimmed.slice(0, 2200);
        }

        const utmUrl = attachSmartLinkAttribution(smartLinkUrl, platform, campaignSlug);
        const alreadyIncluded = trimmed.includes('utm_source=');
        const combined = alreadyIncluded ? trimmed : `${trimmed} ${utmUrl}`.trim();

        if (platform !== 'X') {
            return combined.slice(0, 2200);
        }
        if (combined.length <= 280) {
            return combined;
        }
        if (alreadyIncluded) {
            return combined.slice(0, 280);
        }
        const suffix = ` ${utmUrl}`;
        const maxCopyLen = 280 - suffix.length;
        if (maxCopyLen <= 4) {
            return utmUrl.slice(0, 280);
        }
        const shortened = `${trimmed.slice(0, maxCopyLen - 3).trimEnd()}...${suffix}`;
        return shortened.slice(0, 280);
    }

    /**
     * Convert generated plan to CampaignAsset format ready for persistence
     */
    planToCampaignAsset(plan: GeneratedCampaignPlan, startDate: string): CampaignAsset {
        const posts: ScheduledPost[] = plan.posts.map((p, index) => ({
            id: `post_${Date.now()}_${index}`,
            platform: p.platform as Platform,
            subject: p.subject,
            copy: p.subject ? p.copy : (p.copy + '\n\n' + p.hashtags.join(' ')),
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
    // 2. INTELLIGENCE POST ENHANCEMENT
    // =========================================================================

    /**
     * Enhance/rewrite existing post copy
     */
    async enhancePostCopy(
        post: ScheduledPost,
        enhancementType: EnhancementType
    ): Promise<PostEnhancement> {
        const brandContext = await this.getBrandContext();

        const instructions: Record<EnhancementType, string> = {
            improve: 'Make this copy more engaging, impactful, and likely to drive engagement while preserving the core message.',
            shorter: 'Create a more concise version that fits platform character limits better while maintaining impact.',
            longer: 'Expand this copy with more detail, storytelling, and context while keeping it engaging and on-brand.',
            different_tone: 'Rewrite with a fresh perspective and different emotional approach while keeping the core message.'
        };

        const platformLimits: Record<Platform, number> = {
            Twitter: 280,
            Instagram: 2200
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
            const result = await GenAI.generateStructuredData<PostEnhancement>(prompt, schema);

            return {
                enhancedCopy: result.enhancedCopy || post.copy,
                alternativeVersions: Array.isArray(result.alternativeVersions) ? result.alternativeVersions : [],
                suggestedHashtags: Array.isArray(result.suggestedHashtags) ? result.suggestedHashtags : [],
                toneAnalysis: result.toneAnalysis || ''
            };
        } catch (_error: unknown) {
            throw new Error('Failed to enhance post copy. Please try again.');
        }
    }

    // =========================================================================
    // 2.5 INTELLIGENCE VIDEO GENERATION (Marketing Assets)
    // =========================================================================

    /**
     * Generate a short-form video asset for marketing.
     *
     * Text-to-video only. The shared video service owns admission, durable jobs,
     * and provider polling; a queued job is not a completed marketing asset.
     */
    async generateMarketingVideo(
        prompt: string,
        style: string,
        config?: Record<string, unknown>
    ): Promise<string> {
        const brandContext = await this.getBrandContext();

        const enhancedPrompt = `
Generate a high-fidelity marketing video asset.

BRAND CONTEXT:
${brandContext}

VISUAL STYLE: ${style}
BASE PROMPT: ${prompt}

The video should be visually striking, on-brand, and optimized for short-form social media (Reels, TikTok).
Focus on dynamic movements, high-quality textures, and brand alignment.
`;

        const results = await VideoGeneration.generateVideo({
            prompt: enhancedPrompt,
            model: 'fast',
            durationSeconds: typeof config?.durationSeconds === 'number' ? config.durationSeconds : 8,
            aspectRatio: config?.aspectRatio === '16:9' ? '16:9' : '9:16',
        });
        const job = results[0];
        if (!job) throw new Error('Marketing video generation returned no job.');
        const url = job.url || (await VideoGeneration.waitForJob(job.id)).videoUrl;
        if (!url) throw new Error('Marketing video generation completed without a video URL.');
        return url;
    }

    // =========================================================================
    // 3. INTELLIGENCE IMAGE GENERATION (Batch with Progress)
    // =========================================================================

    /**
     * Generate images for posts missing visuals
     * Sequential processing to avoid rate limits (following EditingService pattern)
     */
    async generatePostImages(
        posts: ScheduledPost[],
        onProgress?: (progress: BatchImageProgress) => void,
        options?: { imageModelTier?: MarketingImageModelTier }
    ): Promise<ScheduledPost[]> {
        const postsNeedingImages = posts.filter(p => !p.imageAsset.imageUrl);
        const total = postsNeedingImages.length;

        if (total === 0) {
            return posts;
        }

        const updatedPosts = new Map<string, ScheduledPost>();
        const targetImageModel = resolveMarketingImageModel(options?.imageModelTier);

        // Process sequentially to avoid rate limits
        for (let i = 0; i < total; i++) {
            const post = postsNeedingImages[i]!;

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
                    ? await this.enhanceImagePrompt(post.imageAsset.caption)
                    : await this.generateImagePromptFromCopy(post.copy, post.platform);

                const base64 = await GenAI.generateImage(imagePrompt, targetImageModel);

                const imageUrl = await this.persistGeneratedImage(base64);

                updatedPosts.set(post.id, {
                    ...post,
                    imageAsset: {
                        ...post.imageAsset,
                        imageUrl
                    }
                } as ScheduledPost);
                onProgress?.({ current: i + 1, total, currentPostId: post.id, status: 'complete' });

            } catch (_error: unknown) {
                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total,
                        currentPostId: post.id,
                        status: 'error'
                    });
                }
            }
        }

        // Return all posts with updated ones merged in
        return posts.map(post => updatedPosts.get(post.id) || post);
    }

    /**
     * Generate a single image for a post
     */
    async generateSingleImage(
        post: ScheduledPost,
        options?: { imageModelTier?: MarketingImageModelTier }
    ): Promise<string | null> {
        const imagePrompt = post.imageAsset.caption
            ? await this.enhanceImagePrompt(post.imageAsset.caption)
            : await this.generateImagePromptFromCopy(post.copy, post.platform);

        const base64 = await GenAI.generateImage(
            imagePrompt,
            resolveMarketingImageModel(options?.imageModelTier)
        );

        return this.persistGeneratedImage(base64);
    }

    private async persistGeneratedImage(base64: string): Promise<string> {
        const dataUrl = `data:image/png;base64,${base64}`;

        try {
            const userId = auth.currentUser?.uid || 'anonymous';
            const gsUri = await CreativeStorageService.uploadReferenceMedia(userId, dataUrl, 'image');
            return await getDownloadURL(ref(storage, gsUri));
        } catch (_error: unknown) {
            throw new Error('Failed to persist generated image to Cloud Storage.');
        }
    }

    /**
     * Generate an image prompt from post copy
     */
    private async generateImagePromptFromCopy(copy: string, platform: Platform): Promise<string> {
        const brandContext = await this.getBrandContext();

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
            return await GenAI.generateText(prompt);
        } catch (_error: unknown) {
            return `Modern, visually striking social media graphic for ${platform}`;
        }
    }

    /**
     * Enhance image prompt with brand context
     */
    private async enhanceImagePrompt(prompt: string): Promise<string> {
        const { useStore } = await import('@/core/store');
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
    // 4. INTELLIGENCE PERFORMANCE PREDICTION
    // =========================================================================

    /**
     * Predict engagement metrics for a campaign
     */
    async predictEngagement(campaign: CampaignAsset): Promise<EngagementPrediction> {
        const brandContext = await this.getBrandContext();

        const postsAnalysis = campaign.posts.slice(0, 10).map(p => ({
            platform: p.platform,
            day: p.day,
            copyLength: p.copy.length,
            hasImage: !!p.imageAsset.imageUrl,
            copyPreview: p.copy.substring(0, 150)
        }));

        const platformMix = this.getPlatformMix(campaign.posts);

        const prompt = `
You are a social media analytics expert with deep knowledge of platform algorithms and viral mechanics.
You specifically understand what triggers "TikTok FYP", "Instagram Explore", and "Twitter (X) Trending" algorithms.

BRAND CONTEXT:
${brandContext}

CAMPAIGN DETAILS:
- Title: ${campaign.title}
- Description: ${campaign.description || 'N/A'}
- Duration: ${campaign.durationDays} days
- Total Posts: ${campaign.posts.length}
- Platform Distribution: ${platformMix}
- Posts with Images: ${campaign.posts.filter(p => p.imageAsset.imageUrl).length}/${campaign.posts.length}

POST DATA:
${JSON.stringify(postsAnalysis, null, 2)}

TASK:
1. Predict the overall engagement performance.
2. Calculate the 'Viral Probability' (0.0 to 1.0) of this campaign triggering a significant algorithmic surge.
3. Identify exactly which Post IDs from the list have the highest potential for breakout success.
4. Provide actionable recommendations to maximize the 'Viral Velocity'.

Consider:
- High-hook opening lines in copy.
- Visual continuity with brand aesthetic.
- Shareability of specific concepts.
- Algorithmic favorability (e.g., carousel potential on IG, controversial hooks on Twitter).

Provide realistic estimates:
- Twitter: 1-3% engagement
- Instagram: 3-6% engagement
- LinkedIn: 2-4% engagement

Base reach estimates on a modest following of 5,000-10,000 combined followers.
`;

        const schema = {
            nullable: false,
            type: 'object',
            properties: {
                overallScore: { type: 'number' },
                estimatedReach: { type: 'number' },
                estimatedEngagementRate: { type: 'number' },
                viralProbability: { type: 'number', description: 'Probability of viral breakout (0.0-1.0)' },
                highPotentialAssets: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'IDs of posts with highest breakout potential'
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
                recommendations: { type: 'array', items: { type: 'string' } },
                riskFactors: { type: 'array', items: { type: 'string' } }
            },
            required: ['overallScore', 'estimatedReach', 'estimatedEngagementRate', 'viralProbability', 'highPotentialAssets', 'platformBreakdown', 'recommendations', 'riskFactors']
        };

        try {
            const result = await GenAI.generateStructuredData<EngagementPrediction>(prompt, schema);

            return {
                overallScore: result.overallScore || 50,
                estimatedReach: result.estimatedReach || 0,
                estimatedEngagementRate: result.estimatedEngagementRate || 0,
                viralProbability: result.viralProbability || 0,
                highPotentialAssets: Array.isArray(result.highPotentialAssets) ? result.highPotentialAssets : [],
                platformBreakdown: Array.isArray(result.platformBreakdown) ? result.platformBreakdown : [],
                recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
                riskFactors: Array.isArray(result.riskFactors) ? result.riskFactors : []
            };
        } catch (_error: unknown) {
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
    private async getBrandContext(): Promise<string> {
        const { useStore } = await import('@/core/store');
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

    // =========================================================================
    // JEV SYSTEM ONE FAST-PATH EVALUATION (GROWTH INTELLIGENCE)
    // =========================================================================

    /**
     * Real-time bid & budget adjustment via Jev System One
     * Sub-100ms classifier replacing heavy LLM loops with deterministic action contracts.
     */
    async evaluateRealTimeBidAdjustment(
        snapshot: import('@/config/typesafeJudgments').CampaignMetricSnapshot
    ): Promise<import('@/config/typesafeJudgments').CampaignDecisionContract> {
        const { judgeCampaignBidAction } = await import('@/config/typesafeJudgments');
        return judgeCampaignBidAction(snapshot);
    }

    /**
     * Parallel ad creative compliance triage
     * Evaluates 20+ ad copy variations in parallel under 200ms.
     */
    async triageAdCreatives(
        creatives: import('@/config/typesafeJudgments').AdCreativeVariant[],
        artistBrandVibe?: string
    ): Promise<string[]> {
        const { judgeAdCreativeBatchCompliance } = await import('@/config/typesafeJudgments');
        return judgeAdCreativeBatchCompliance(creatives, artistBrandVibe);
    }
}

// Singleton export (following EditingService pattern)
export const CampaignIntelligence = new CampaignIntelligenceService();
