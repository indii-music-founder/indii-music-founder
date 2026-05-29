import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { z } from "zod";
import { geminiApiKey } from "../config/secrets";

export const CampaignStatusSchema = z.enum(['PENDING', 'EXECUTING', 'DONE', 'FAILED']);

export const ScheduledPostSchema = z.object({
    id: z.string(),
    platform: z.enum(['Twitter', 'Instagram', 'LinkedIn']),
    copy: z.string(),
    imageAsset: z.object({
        assetType: z.literal('image'),
        title: z.string(),
        imageUrl: z.string(),
        caption: z.string().optional(),
    }).optional(),
    day: z.number().optional(),
    scheduledTime: z.union([z.date(), z.string(), z.number()]).optional(),
    status: CampaignStatusSchema,
});

export const CampaignExecutionRequestSchema = z.object({
    campaignId: z.string(),
    posts: z.array(ScheduledPostSchema),
    dryRun: z.boolean().optional().default(false),
});

export type CampaignExecutionRequest = z.infer<typeof CampaignExecutionRequestSchema>;

const SUPPORTED_SOCIAL_PLATFORMS = ['Twitter', 'Instagram'] as const;
type SupportedCampaignPlatform = typeof SUPPORTED_SOCIAL_PLATFORMS[number];

function toDeliveryPlatform(platform: SupportedCampaignPlatform): 'twitter' | 'instagram' {
    return platform === 'Twitter' ? 'twitter' : 'instagram';
}

function scheduledAtForPost(post: z.infer<typeof ScheduledPostSchema>): admin.firestore.Timestamp {
    if (post.scheduledTime) {
        const date = new Date(post.scheduledTime);
        if (!Number.isNaN(date.getTime())) {
            return admin.firestore.Timestamp.fromDate(date);
        }
    }

    const dayOffset = Math.max(0, (Number((post as { day?: number }).day) || 1) - 1);
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    return admin.firestore.Timestamp.fromDate(date);
}

function normalizeDispatchPlatform(platform: unknown): 'twitter' | 'instagram' | 'tiktok' {
    const normalized = String(platform || '').toLowerCase().trim();
    if (normalized === 'twitter' || normalized === 'x') return 'twitter';
    if (normalized === 'instagram' || normalized === 'ig' || normalized === 'meta_reels') return 'instagram';
    if (normalized === 'tiktok') return 'tiktok';
    throw new functions.https.HttpsError(
        "failed-precondition",
        `Social platform '${String(platform)}' is not wired for native delivery.`
    );
}

/**
 * Executes a social media campaign.
 * Queues supported posts for the scheduled social delivery worker.
 */
export const executeCampaign = functions
    .runWith({ enforceAppCheck: true,  secrets: [geminiApiKey], timeoutSeconds: 60  })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "Auth required");
        }

        const validation = CampaignExecutionRequestSchema.safeParse(data);
        if (!validation.success) {
            throw new functions.https.HttpsError("invalid-argument", validation.error.message);
        }

        const { campaignId, posts, dryRun } = validation.data;

        console.log(`[Marketing] Executing Campaign ${campaignId} (DryRun: ${dryRun})`);

        const unsupported = posts.filter(p => !SUPPORTED_SOCIAL_PLATFORMS.includes(p.platform as SupportedCampaignPlatform));
        if (unsupported.length > 0) {
            throw new functions.https.HttpsError(
                "failed-precondition",
                `Campaign contains platforms without native delivery: ${unsupported.map(p => p.platform).join(', ')}.`
            );
        }

        if (dryRun) {
            return {
                success: true,
                posts,
                message: "Dry run successful. Posts validated for scheduled delivery."
            };
        }

        const db = admin.firestore();
        const queuedPosts = await Promise.all(posts.map(async (post) => {
            const platform = post.platform as SupportedCampaignPlatform;
            const scheduledAt = scheduledAtForPost(post);
            const mediaUrl = (post as { imageAsset?: { imageUrl?: string } }).imageAsset?.imageUrl;
            const docRef = await db.collection('scheduledPosts').add({
                userId: context.auth!.uid,
                campaignId,
                campaignPostId: post.id,
                platform: toDeliveryPlatform(platform),
                text: post.copy,
                mediaUrl: mediaUrl || null,
                mediaType: mediaUrl ? 'image' : null,
                scheduledAt,
                status: 'pending',
                source: 'campaign_manager',
                retryCount: 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return {
                ...post,
                postId: docRef.id,
                status: 'EXECUTING' as const,
                scheduledTime: scheduledAt.toDate().toISOString()
            };
        }));

        return {
            success: true,
            posts: queuedPosts,
            message: "Campaign posts queued for scheduled delivery."
        };
    });

/**
 * Dispatches a specific media post to a social platform (TikTok, IG, YT).
 * Fulfills PRODUCTION_200:141.
 */
export const dispatchSocialPost = functions
    .region("us-central1")
    .runWith({ enforceAppCheck: true,  timeoutSeconds: 120, memory: "512MB"  })
    .https.onCall(async (data: Record<string, unknown>, context: functions.https.CallableContext) => {
        if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Auth required");

        const { mediaUrl, platform, caption } = data;
        const normalizedPlatform = normalizeDispatchPlatform(platform);
        console.info(`[SocialPost] Queueing ${normalizedPlatform}: ${mediaUrl}`);

        const docRef = await admin.firestore().collection('scheduledPosts').add({
            userId: context.auth.uid,
            platform: normalizedPlatform,
            text: String(caption || ''),
            mediaUrl: typeof mediaUrl === 'string' ? mediaUrl : null,
            mediaType: typeof mediaUrl === 'string' && mediaUrl ? 'video' : null,
            scheduledAt: admin.firestore.Timestamp.now(),
            status: 'pending',
            source: 'social_auto_poster',
            retryCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            success: true,
            externalId: docRef.id,
            status: 'queued',
            timestamp: new Date().toISOString()
        };
    });

/**
 * Creates and persists a tracking link for an influencer.
 * Fulfills PRODUCTION_200:149.
 */
export const createInfluencerBounty = functions
    .region("us-central1")
    .runWith({ enforceAppCheck: true,  timeoutSeconds: 60, memory: "256MB"  })
    .https.onCall(async (data: Record<string, unknown>, context: functions.https.CallableContext) => {
        if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Auth required");

        const { influencerHandle, trackName, rewardAmount: _rewardAmount } = data;
        const bountyBaseUrl = process.env.INFLUENCER_BOUNTY_BASE_URL;
        if (!bountyBaseUrl) {
            throw new functions.https.HttpsError(
                "failed-precondition",
                "Influencer bounty base URL is not configured."
            );
        }

        const refCode = `REF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const link = `${bountyBaseUrl.replace(/\/$/, '')}/ref/${refCode}`;

        await admin.firestore().collection('influencerBounties').doc(refCode).set({
            userId: context.auth.uid,
            influencerHandle,
            trackName,
            rewardAmount: _rewardAmount ?? null,
            refCode,
            link,
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.info(`[Bounty] Created bounty for ${influencerHandle} on ${trackName}`);

        return {
            success: true,
            refCode,
            link
        };
    });
