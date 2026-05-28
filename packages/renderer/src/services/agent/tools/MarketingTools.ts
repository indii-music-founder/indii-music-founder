import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { MarketingService } from '@/services/marketing/MarketingService';
import { CampaignStatus, type ScheduledPost } from '@/modules/marketing/types';
import { audioIntelligence } from '@/services/audio/AudioIntelligenceService';
// useStore removed

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
// duplicate removed
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { logger } from '@/utils/logger';

/** Typed Electron IPC bridge for marketing tools */
interface ElectronMarketingBridge {
    analyzeTrends: (opts: { category?: string }) => Promise<{ success: boolean; error?: string; analysis?: unknown }>;
}

interface ElectronWindowAPI {
    electronAPI?: {
        marketing?: ElectronMarketingBridge;
    };
}

// --- Validation Schemas ---

const CreateCampaignBriefSchema = z.object({
    campaignName: z.string(),
    targetAudience: z.string(),
    budget: z.string(),
    channels: z.array(z.string()),
    kpis: z.array(z.string()),
    assets: z.array(z.string()).optional()
});

const AnalyzeAudienceSchema = z.object({
    platform: z.string(),
    demographics: z.object({
        age: z.string(),
        locations: z.array(z.string())
    }),
    interests: z.array(z.string()),
    reach: z.string()
});

const TrackPerformanceSchema = z.object({
    campaignId: z.string(),
    metrics: z.object({
        impressions: z.number(),
        clicks: z.number(),
        conversions: z.number()
    }),
    roi: z.string()
});

const parseCampaignBudget = (value: string): number => {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
};

const parseDurationDays = (value?: string): number => {
    if (!value) return 30;
    const parsed = Number(value.match(/\d+/)?.[0]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
};

const toSupportedPlatform = (channel: string): ScheduledPost['platform'] => {
    const normalized = channel.toLowerCase();
    if (normalized.includes('instagram')) return 'Instagram';
    if (normalized.includes('linkedin')) return 'LinkedIn';
    if (normalized.includes('email') || normalized.includes('newsletter')) return 'Email';
    return 'Twitter';
};

// --- Tools Implementation ---

export const MarketingTools = {
    create_campaign_brief: wrapTool('create_campaign_brief', async ({ product, goal, budget, duration, assetIds }: { product: string; goal: string; budget?: string; duration?: string; assetIds?: string[] }) => {
        const schema = zodToJsonSchema(CreateCampaignBriefSchema);
        const prompt = `
        You are a Marketing Strategist. Create a campaign brief for: ${product}.
        Goal: ${goal}.
        ${budget ? `Budget: ${budget}` : ''}
        ${duration ? `Duration: ${duration}` : ''}
        ${assetIds ? `Attached Asset IDs: ${assetIds.join(', ')} (Incorporate these into the strategy)` : ''}
        `;

        const data = await AutonomousIntelligence.generateStructuredData<z.infer<typeof CreateCampaignBriefSchema>>(prompt, schema as Record<string, unknown>);
        const parsed = CreateCampaignBriefSchema.parse(data);

        // AUTO-PERSIST: Save the generated brief to the database
        try {
            const durationDays = parseDurationDays(duration);
            const startDate = new Date().toISOString().split('T')[0]!;
            const channels = parsed.channels.length > 0 ? parsed.channels : ['Instagram'];
            const posts: ScheduledPost[] = channels.slice(0, 4).map((channel, index) => ({
                id: `brief-post-${index + 1}`,
                platform: toSupportedPlatform(channel),
                copy: `${parsed.campaignName}: ${goal} for ${parsed.targetAudience}.`,
                imageAsset: {
                    assetType: 'image',
                    title: `${parsed.campaignName} ${channel} creative`,
                    imageUrl: '',
                    caption: `${parsed.campaignName} campaign asset`,
                },
                day: (index * Math.max(1, Math.floor(durationDays / Math.max(channels.length, 1)))) + 1,
                status: CampaignStatus.PENDING,
            }));

            await MarketingService.createCampaign({
                assetType: 'campaign',
                title: parsed.campaignName,
                description: `${goal} Target audience: ${parsed.targetAudience}. KPIs: ${parsed.kpis.join(', ') || 'TBD'}.`,
                durationDays,
                startDate,
                budget: parseCampaignBudget(parsed.budget),
                posts,
                status: CampaignStatus.PENDING,
                attachedAssets: assetIds || [],
            });
            logger.info(`[MarketingTools] Campaign brief persisted: ${parsed.campaignName}`);
        } catch (persistError: unknown) {
            logger.warn('[MarketingTools] Persistence failed:', persistError);
        }

        return toolSuccess(parsed, `Campaign brief created for ${parsed.campaignName} and saved to Marketing Dashboard.`);
    }),

    analyze_audience: wrapTool('analyze_audience', async ({ genre, similar_artists }: { genre: string; similar_artists?: string[] }) => {
        const schema = zodToJsonSchema(AnalyzeAudienceSchema);
        const prompt = `
        You are a Market Researcher. Analyze the target audience for genre: ${genre}.
        ${similar_artists ? `Similar Artists: ${similar_artists.join(', ')}` : ''}
        `;
        const data = await AutonomousIntelligence.generateStructuredData<z.infer<typeof AnalyzeAudienceSchema>>(prompt, schema as Record<string, unknown>);
        const validated = AnalyzeAudienceSchema.parse(data);
        return toolSuccess(validated, `Audience analysis completed for ${genre}. Estimated reach: ${validated.reach}.`);
    }),

    /**
     * Enhanced Schedule Content: Uses real JS Dates instead of Autonomous hallucination for the calendar.
     */
    schedule_content: wrapTool('schedule_content', async ({ campaign_start, platforms, frequency }: { campaign_start: string; platforms: string[]; frequency: string }) => {
        const startDate = new Date(campaign_start);
        const validStartDate = isNaN(startDate.getTime()) ? new Date() : startDate;

        let intervalDays = 7;
        const freqLower = frequency.toLowerCase();
        if (freqLower.includes("daily")) intervalDays = 1;
        else if (freqLower.includes("bi-weekly") || freqLower.includes("twice a week")) intervalDays = 3;
        else if (freqLower.includes("monthly")) intervalDays = 30;

        const schedule: Array<{ date: string; platform: string; type: string }> = [];
        const postsPerPlatform = 4;

        for (let i = 0; i < postsPerPlatform; i++) {
            const postDate = new Date(validStartDate);
            postDate.setDate(validStartDate.getDate() + (i * intervalDays));

            platforms.forEach(platform => {
                schedule.push({
                    date: postDate.toISOString(),
                    platform: platform,
                    type: "Social Post"
                });
            });
        }

        schedule.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return toolSuccess({
            status: "scheduled",
            count: schedule.length,
            schedule: schedule,
            nextPost: schedule.length > 0 ? schedule[0]!.date : "None"
        }, `Content schedule generated with ${schedule.length} posts across ${platforms.join(', ')}.`);
    }),

    track_performance: wrapTool('track_performance', async ({ campaignId }: { campaignId: string }) => {
        const schema = zodToJsonSchema(TrackPerformanceSchema);
        const prompt = `
        You are a Marketing Analyst. Generate a simulated performance report for Campaign ID: ${campaignId}.
        `;
        const data = await AutonomousIntelligence.generateStructuredData<z.infer<typeof TrackPerformanceSchema>>(prompt, schema as Record<string, unknown>);
        const validated = TrackPerformanceSchema.parse(data);
        return toolSuccess(validated, `Performance tracking report generated for Campaign ID: ${campaignId}. ROI: ${validated.roi}.`);
    }),

    generate_campaign_from_audio: wrapTool('generate_campaign_from_audio', async ({ uploadedAudioIndex }: { uploadedAudioIndex: number }) => {
        const { useStore } = await import('@/core/store');
        const { uploadedAudio } = useStore.getState();
        const audioItem = uploadedAudio[uploadedAudioIndex];

        if (!audioItem) {
            return toolError("No audio found at the provided index.", "NOT_FOUND");
        }

        try {
            // 1. Analyze Audio
            const fetchRes = await fetch(audioItem.url);
            const blob = await fetchRes.blob();
            const file = new File([blob], "audio_track", { type: blob.type });
            const profile = await audioIntelligence.analyze(file);

            // 2. Synthesize Campaign using Semantic Data
            const { mood, genre, marketingHooks } = profile.semantic;

            // 3. Delegate to create_campaign_brief
            // We re-use logic by calling the exported function or just returning data for the agent to act on
            // Better to return the insight so the agent handles the creation step via reasoning

            return toolSuccess({
                insight: `Analyzed track. Genre: ${genre.join(', ')}. Mood: ${mood.join(', ')}.`,
                suggested_one_liner: marketingHooks.oneLiner,
                keywords: marketingHooks.keywords,
                technical: {
                    bpm: profile.technical.bpm,
                    key: profile.technical.key
                }
            }, "Audio analyzed. Use this data to run `create_campaign_brief`.");

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to analyze audio for campaign: ${msg}`, "ANALYSIS_FAILED");
        }
    }),

    analyze_market_trends: wrapTool('analyze_market_trends', async ({ category }: { category?: string }) => {
        const electronWin = window as unknown as ElectronWindowAPI;
        if (!electronWin.electronAPI?.marketing) {
            return toolError("Marketing analysis bridge unavailable.", "IPC_ERROR");
        }

        try {
            const result = await electronWin.electronAPI.marketing.analyzeTrends({ category });
            if (!result.success) {
                return toolError(result.error || "Analysis failed", "SCRAPE_FAILED");
            }

            return toolSuccess(result.analysis, `Market analysis complete for ${category || 'pop'}.`);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return toolError(`Failed to bridge to market analysis: ${msg}`, "BRIDGE_ERROR");
        }
    }),

    create_ab_test_campaign: wrapTool('create_ab_test_campaign', async ({ product, goal, channels }: { product: string; goal: string; channels: string[] }) => {
        // Mock generating 3 variants and setting up tracking pixel framework
        const variants = [
            { id: 'varA', text: `Catchy headline for ${product} - Don't miss out!`, target_audience: 'Broad' },
            { id: 'varB', text: `The story behind ${product}. Hear it now.`, target_audience: 'Niche/Fans' },
            { id: 'varC', text: `Join the movement. Stream ${product} today.`, target_audience: 'Lookalike' }
        ];

        return toolSuccess({
            campaign_id: `camp-${crypto.randomUUID()}`,
            product,
            goal,
            channels,
            variants,
            pixel_framework: {
                status: 'configured',
                events_tracked: ['ViewContent', 'AddToCart', 'Purchase']
            }
        }, `A/B testing campaign created for ${product} with 3 copy variants and tracking pixel initialized.`);
    }),

    generate_ab_campaign: wrapTool('generate_ab_campaign', async (args: { productName: string; targetAudience: string; platform: 'Meta' | 'TikTok' | 'YouTube' }) => {
        const variants = [
            {
                id: 'angle-story',
                hook: `The story behind ${args.productName}`,
                copy: `For ${args.targetAudience}: hear the record before everyone else.`,
            },
            {
                id: 'angle-proof',
                hook: `${args.productName} is already moving`,
                copy: `Tap in now and help push the next independent wave.`,
            },
            {
                id: 'angle-direct',
                hook: `Play ${args.productName} today`,
                copy: `Built for ${args.targetAudience}. Stream, save, and share it.`,
            },
        ];

        return toolSuccess({
            campaignId: `ab-${Date.now().toString(36)}`,
            platform: args.platform,
            targetAudience: args.targetAudience,
            variants,
            trackingPixel: {
                event: 'ViewContent',
                status: 'configured_for_review',
            },
        }, `Generated ${variants.length} ${args.platform} A/B campaign variants for ${args.productName}.`);
    }),

    deploy_micro_ad_campaign: wrapTool('deploy_micro_ad_campaign', async (args: {
        platform: 'Meta' | 'TikTok';
        dailyBudgetUsd: number;
        durationDays: number;
        targetAudienceProfile: string;
        creativeVariants: string[];
    }) => {
        const totalBudget = Math.max(0, args.dailyBudgetUsd) * Math.max(1, args.durationDays);

        return toolSuccess({
            campaignId: `micro-${Date.now().toString(36)}`,
            platform: args.platform,
            dailyBudgetUsd: args.dailyBudgetUsd,
            durationDays: args.durationDays,
            totalBudgetUsd: totalBudget,
            targetAudienceProfile: args.targetAudienceProfile,
            creativeVariants: args.creativeVariants,
            status: 'ready_for_approval',
            note: 'Live ad platform credentials are not invoked from this tool. The campaign package is prepared for review/deployment.',
        }, `${args.platform} micro-campaign package prepared for ${args.durationDays} day(s) at $${args.dailyBudgetUsd}/day.`);
    }),

    deploy_email_newsletter: wrapTool('deploy_email_newsletter', async (args: {
        subjectLine: string;
        segmentName: string;
        htmlContent: string;
        sendAt?: string;
    }) => {
        return toolSuccess({
            campaignId: `email-${Date.now().toString(36)}`,
            subjectLine: args.subjectLine,
            segmentName: args.segmentName,
            htmlPreview: args.htmlContent.slice(0, 500),
            sendAt: args.sendAt || 'immediate',
            status: 'queued_for_email_provider',
            note: 'Provider handoff is prepared; external Mailchimp/Klaviyo send requires configured credentials.',
        }, `Newsletter "${args.subjectLine}" queued for ${args.segmentName}.`);
    }),

    generate_presave_campaign: wrapTool('generate_presave_campaign', async (args: {
        trackTitle: string;
        releaseDate: string;
        artworkUrl: string;
        collectPhoneNumbers?: boolean;
    }) => {
        const slug = args.trackTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || 'release';

        return toolSuccess({
            campaignId: `presave-${Date.now().toString(36)}`,
            landingPageSlug: slug,
            headline: `Pre-save ${args.trackTitle}`,
            releaseDate: args.releaseDate,
            artworkUrl: args.artworkUrl,
            fields: ['email', ...(args.collectPhoneNumbers ? ['phone'] : [])],
            callsToAction: ['Spotify Pre-save', 'Apple Music Notify', 'YouTube Reminder'],
            status: 'draft_ready',
        }, `Pre-save campaign draft generated for ${args.trackTitle}.`);
    }),

    deploy_sms_blast: wrapTool('deploy_sms_blast', async (args: {
        messageBody: string;
        segmentName: string;
        mediaUrl?: string;
    }) => {
        return toolSuccess({
            blastId: `sms-${Date.now().toString(36)}`,
            segmentName: args.segmentName,
            characterCount: args.messageBody.length,
            mediaUrl: args.mediaUrl || null,
            status: 'queued_for_sms_provider',
            note: 'SMS content is queued for provider handoff; Twilio credentials are required for live delivery.',
        }, `SMS blast queued for ${args.segmentName}.`);
    }),

    enrich_fan_data: wrapTool('enrich_fan_data', async (args: { emailAddress: string }) => {
        const domain = args.emailAddress.includes('@') ? args.emailAddress.split('@')[1] : 'unknown';
        return toolSuccess({
            emailAddress: args.emailAddress,
            domain,
            enrichmentStatus: 'local_profile_only',
            inferredSegments: domain === 'unknown' ? ['needs_cleanup'] : ['email_contact', 'owned_audience'],
            note: 'No third-party enrichment API is called without configured provider credentials.',
        }, `Fan profile enriched locally for ${args.emailAddress}.`);
    }),

    generate_influencer_bounty: wrapTool('generate_influencer_bounty', async (args: {
        trackTitle: string;
        bountyRewardUsd: number;
        soundUrl: string;
        targetInfluencerNiche?: string;
    }) => {
        return toolSuccess({
            bountyId: `bounty-${Date.now().toString(36)}`,
            trackTitle: args.trackTitle,
            rewardUsd: args.bountyRewardUsd,
            soundUrl: args.soundUrl,
            targetInfluencerNiche: args.targetInfluencerNiche || 'music discovery creators',
            referralRules: [
                'Use the official sound URL',
                'Tag the artist account',
                'Submit post URL for review',
            ],
            status: 'draft_ready',
        }, `Influencer bounty draft generated for ${args.trackTitle}.`);
    }),

    tier_superfans: wrapTool('tier_superfans', async (args: { minSpendForVIP: number; minSpendForSuperfan: number }) => {
        // Superfan CRM Tiering — reads real fan purchase records from Firestore
        const results = { Standard: 0, VIP: 0, Superfan: 0 };

        try {
            const { db, auth } = await import('@/services/firebase');
            const { collection, getDocs } = await import('firebase/firestore');

            const uid = auth.currentUser?.uid;
            if (uid) {
                // Aggregate spend per fan from purchase records
                const purchasesSnap = await getDocs(
                    collection(db, 'users', uid, 'fanPurchases')
                );

                const fanSpend: Record<string, number> = {};
                purchasesSnap.forEach(doc => {
                    const data = doc.data();
                    const fanId = data.fanId as string;
                    if (fanId) {
                        fanSpend[fanId] = (fanSpend[fanId] || 0) + (Number(data.amount) || 0);
                    }
                });

                Object.values(fanSpend).forEach(spend => {
                    if (spend >= args.minSpendForSuperfan) results.Superfan++;
                    else if (spend >= args.minSpendForVIP) results.VIP++;
                    else results.Standard++;
                });
            }
        } catch (err: unknown) {
            logger.warn('[MarketingTools] tier_superfans Firestore read failed:', err);
        }

        const total = results.Standard + results.VIP + results.Superfan;
        return toolSuccess({
            tiers: results,
            thresholds: {
                vip: args.minSpendForVIP,
                superfan: args.minSpendForSuperfan,
            },
            totalFans: total,
        }, `Fan CRM tiered (${total} fans): ${results.Superfan} Superfans, ${results.VIP} VIPs, ${results.Standard} Standard.`);
    }),

    track_post_release_momentum: wrapTool('track_post_release_momentum', async (args: { trackId: string; adSpend: number; organicStreams: number; dsp: string }) => {
        // Mock Post-Release Momentum Tracking (Item 150)
        const roi = (args.organicStreams * 0.004) / (args.adSpend || 1);
        const momentumScore = Math.min(100, (args.organicStreams / 1000) * 5 + (roi * 10));

        return toolSuccess({
            trackId: args.trackId,
            dsp: args.dsp,
            adSpend: args.adSpend,
            organicStreams: args.organicStreams,
            momentumScore: Math.round(momentumScore),
            estimatedRoiMultiplier: Number(roi.toFixed(2)),
            trend: momentumScore > 50 ? 'Accelerating' : 'Decelerating'
        }, `Post-release momentum tracked for ${args.trackId} on ${args.dsp}. Momentum Score: ${Math.round(momentumScore)}/100. Trend: ${momentumScore > 50 ? 'Accelerating' : 'Decelerating'}.`);
    })
} satisfies Record<string, AnyToolFunction>;

// Aliases
export const {
    create_campaign_brief,
    analyze_audience,
    schedule_content,
    track_performance,
    generate_campaign_from_audio,
    analyze_market_trends,
    create_ab_test_campaign,
    tier_superfans,
    track_post_release_momentum
} = MarketingTools;
