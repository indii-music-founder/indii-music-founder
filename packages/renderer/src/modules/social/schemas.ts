import { z } from "zod";

const InstagramPublishingPayloadSchema = z.object({
    surface: z.enum(['feed', 'carousel', 'reel', 'story', 'live']),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    caption: z.string(),
    hashtags: z.array(z.string()),
    durationSeconds: z.number().positive().optional(),
    reelAudienceIntent: z.enum(['discovery', 'nurture']).optional(),
    storyExtend: z.boolean().optional(),
    storySegments: z.array(z.object({
        mediaUrl: z.string().url(),
        durationSeconds: z.number().positive(),
        sequence: z.number().int().positive(),
    })).optional(),
});

export const CampaignStatusSchema = z.enum(['PENDING', 'EXECUTING', 'DONE', 'FAILED']);

export const ImageAssetSchema = z.object({
    assetType: z.literal('image'),
    title: z.string(),
    imageUrl: z.string().url(),
    caption: z.string().optional().default('')
});

export const ScheduledPostSchema = z.object({
    id: z.string().optional(), // Optional for creation, required for reading
    platform: z.enum(['Twitter', 'Instagram', 'LinkedIn']),
    copy: z.string().min(1, "Post content is required"),
    imageAsset: ImageAssetSchema.optional(),
    day: z.number().int().min(1).max(31).optional(), // Legacy day support
    scheduledTime: z.union([z.number(), z.date(), z.string()]).transform((val) => {
        if (typeof val === 'number') return val;
        if (val instanceof Date) return val.getTime();
        const parsed = new Date(val).getTime();
        if (!Number.isFinite(parsed)) throw new Error('Invalid date/time');
        return parsed;
    }).refine((ts) => ts > Date.now(), {
        message: "Post must be scheduled for a future time"
    }).optional(),
    status: CampaignStatusSchema.default('PENDING'),
    authorId: z.string().optional(), // Assigned by backend/service
    instagramPayload: InstagramPublishingPayloadSchema.optional(),
});

export const CreatePostRequestSchema = z.object({
    content: z.string().min(1, "Content is required"),
    mediaUrls: z.array(z.string().url()).optional().default([]),
    productId: z.string().optional()
});

export type ScheduledPost = z.infer<typeof ScheduledPostSchema>;
export type CreatePostRequest = z.infer<typeof CreatePostRequestSchema>;
