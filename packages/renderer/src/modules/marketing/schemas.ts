import { z } from "zod";

export const CampaignStatusSchema = z.enum(['PENDING', 'EXECUTING', 'DONE', 'FAILED']);

export const ImageAssetSchema = z.object({
    assetType: z.literal('image'),
    title: z.string(),
    imageUrl: z.string(),
    caption: z.string(),
});

export const ScheduledPostSchema = z.object({
    id: z.string(),
    platform: z.enum(['Twitter', 'Instagram', 'LinkedIn', 'Email']),
    copy: z.string(),
    imageAsset: ImageAssetSchema,
    day: z.number(),
    // Allow Date objects or strings (for JSON serialization)
    scheduledTime: z.union([z.date(), z.string()]).optional(),
    status: CampaignStatusSchema,
    errorMessage: z.string().optional(),
    postId: z.string().optional(),
});

export const CampaignAssetSchema = z.object({
    id: z.string().optional(),
    assetType: z.literal('campaign'),
    title: z.string(),
    description: z.string().optional(),
    durationDays: z.number(),
    startDate: z.string(),
    endDate: z.string().optional(),
    posts: z.array(ScheduledPostSchema),
    status: CampaignStatusSchema,
    attachedAssets: z.array(z.string()).optional(),
});

export const MarketingStatsSchema = z.object({
    totalReach: z.number(),
    engagementRate: z.number(),
    activeCampaigns: z.number(),
});

export const CampaignExecutionRequestSchema = z.object({
    campaignId: z.string().uuid().or(z.string()), // Allow UUID or Firestore ID
    posts: z.array(ScheduledPostSchema),
    dryRun: z.boolean().optional().default(false),
});

export type ImageAsset = z.infer<typeof ImageAssetSchema>;
export type ScheduledPost = z.infer<typeof ScheduledPostSchema>;
export type CampaignAsset = z.infer<typeof CampaignAssetSchema>;
export type MarketingStats = z.infer<typeof MarketingStatsSchema>;
export type CampaignExecutionRequest = z.infer<typeof CampaignExecutionRequestSchema>;
