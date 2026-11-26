import { z } from 'zod';

/**
 * ReleaseLaunchKitSchema — Canonical Level 1 + Level 5 + Level 6 Release Package.
 *
 * Binds one verified audio master + hook windows + locked artist/product visual
 * identity to every downstream deliverable: full music video, short-form reels,
 * multi-shape ads (9:16, 1:1, 4:5, 16:9) with >= 9.0/10 multimodal scorecards,
 * and coordinated social launch posts (Instagram, TikTok, YouTube Shorts, X).
 */

export const LaunchAdShapeSchema = z.enum(['9:16', '1:1', '4:5', '16:9']);
export const LaunchAdDurationSchema = z.union([z.literal(6), z.literal(15), z.literal(30)]);

export const LaunchHookWindowSchema = z.object({
    section: z.enum(['INTRO', 'VERSE', 'PRE_CHORUS', 'CHORUS', 'BRIDGE', 'DROP', 'OUTRO']),
    startTimeSeconds: z.number().finite().nonnegative(),
    endTimeSeconds: z.number().finite().positive(),
    energyLevel: z.enum(['low', 'moderate', 'high', 'peak']),
    lyricSnippet: z.string().max(180).default(''),
}).strict();

export const ScoredAdVariantRecordSchema = z.object({
    variantId: z.string().min(1).max(128),
    shape: LaunchAdShapeSchema,
    durationSeconds: LaunchAdDurationSchema,
    channelLabel: z.string().min(1).max(120),
    renderUrl: z.string().url().optional(),
    canonicalUri: z.string().startsWith('gs://').optional(),
    overallScore: z.number().min(0).max(10),
    brandQcApproved: z.boolean(),
    approved: z.boolean(),
    discardedForRegression: z.boolean().default(false),
    attemptsUsed: z.number().int().min(0).max(5).default(0),
    gapsFound: z.string().max(500).default('None'),
}).strict();

export const LaunchSocialPostSchema = z.object({
    id: z.string().min(1).max(64),
    platform: z.enum(['Instagram', 'InstagramStory', 'TikTok', 'YouTubeShorts', 'X', 'XHeader']),
    copy: z.string().max(2200),
    hashtags: z.array(z.string().max(64)).max(30).default([]),
    attachedVariantId: z.string().max(128).optional(),
    scheduledDayOffset: z.number().int().min(0).max(90).default(0),
    status: z.enum(['draft', 'approved', 'scheduled', 'published']).default('draft'),
}).strict();

export const ReleaseLaunchKitSchema = z.object({
    kitId: z.string().min(1).max(128),
    title: z.string().min(1).max(160),
    artistOrBrandName: z.string().min(1).max(120),
    canonicalRecordingEntityId: z.string().min(1).max(160).optional(),
    canonicalMasterStoragePath: z.string().min(1).max(512).optional(),
    measuredBpm: z.number().finite().positive().optional(),
    hookWindows: z.array(LaunchHookWindowSchema).max(5).default([]),
    lockedReferenceImageUris: z.array(z.string().min(1).max(512)).max(8).default([]),
    lockedSeed: z.number().int().nonnegative().optional(),
    smartLinkUrl: z.string().url().optional(),
    fullMusicVideoProjectId: z.string().max(128).optional(),
    adVariants: z.array(ScoredAdVariantRecordSchema).default([]),
    socialPosts: z.array(LaunchSocialPostSchema).default([]),
    createdAtIso: z.string().datetime(),
}).strict();

export type LaunchAdShape = z.infer<typeof LaunchAdShapeSchema>;
export type LaunchAdDuration = z.infer<typeof LaunchAdDurationSchema>;
export type LaunchHookWindow = z.infer<typeof LaunchHookWindowSchema>;
export type ScoredAdVariantRecord = z.infer<typeof ScoredAdVariantRecordSchema>;
export type LaunchSocialPost = z.infer<typeof LaunchSocialPostSchema>;
export type ReleaseLaunchKit = z.infer<typeof ReleaseLaunchKitSchema>;
