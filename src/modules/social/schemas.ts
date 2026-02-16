import { z } from "zod";

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
        return new Date(val).getTime();
    }).optional(),
    status: CampaignStatusSchema.default('PENDING'),
    authorId: z.string().optional() // Assigned by backend/service
});

export const CreatePostRequestSchema = z.object({
    content: z.string().min(1, "Content is required"),
    mediaUrls: z.array(z.string().url()).optional().default([]),
    productId: z.string().optional()
});

export type ScheduledPost = z.infer<typeof ScheduledPostSchema>;
export type CreatePostRequest = z.infer<typeof CreatePostRequestSchema>;
