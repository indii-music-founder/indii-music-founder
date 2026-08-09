import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { defineString } from "firebase-functions/params";
import { z } from "zod";
import crypto from "crypto";

// Default empty — runtime code below already fails closed with a clean
// HttpsError when this resolves empty (see the bounty-link handler); the
// default only stops this unrelated param from blocking deploy of every
// other function in the codebase.
const influencerBountyBaseUrl = defineString("INFLUENCER_BOUNTY_BASE_URL", { default: "" });

export const CampaignStatusSchema = z.enum(['PENDING', 'EXECUTING', 'DONE', 'FAILED']);

const CampaignIdSchema = z.string().trim().min(1).max(200).regex(/^[^/]+$/, "Invalid campaign ID");

const ScheduledTimeSchema = z.union([
    z.date(),
    z.string(),
    z.number(),
    z.custom<{ toDate: () => Date }>(value => (
        typeof value === 'object'
        && value !== null
        && 'toDate' in value
        && typeof (value as { toDate?: unknown }).toDate === 'function'
    )),
]).refine(value => {
    const date = typeof value === 'object' && value !== null && 'toDate' in value
        ? (value as { toDate: () => Date }).toDate()
        : new Date(value as string | number | Date);
    return !Number.isNaN(date.getTime());
}, "Invalid scheduled time");

export const ScheduledPostSchema = z.object({
    id: z.string().trim().min(1).max(200),
    platform: z.enum(['Twitter', 'Instagram']),
    copy: z.string().max(10_000).refine(value => value.trim().length > 0, 'Post copy is required'),
    imageAsset: z.object({
        assetType: z.literal('image'),
        title: z.string().max(500),
        imageUrl: z.string().max(2_048),
        caption: z.string().max(5_000).optional(),
    }),
    day: z.number().int().min(1).max(365),
    scheduledTime: ScheduledTimeSchema.optional(),
    status: CampaignStatusSchema,
    errorMessage: z.string().max(2_000).optional(),
    postId: z.string().max(200).optional(),
});

export const CampaignExecutionRequestSchema = z.object({
    campaignId: CampaignIdSchema,
    dryRun: z.boolean().optional().default(false),
}).strict();

export type CampaignExecutionRequest = z.infer<typeof CampaignExecutionRequestSchema>;

const PersistedCampaignSchema = z.object({
    userId: z.string().min(1),
    status: CampaignStatusSchema,
    posts: z.array(ScheduledPostSchema).min(1).max(100).superRefine((posts, context) => {
        const seen = new Set<string>();
        posts.forEach((post, index) => {
            if (seen.has(post.id)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Duplicate campaign post ID: ${post.id}`,
                    path: [index, 'id'],
                });
            }
            seen.add(post.id);
        });
    }),
});

const ExistingQueueSchema = z.object({
    userId: z.string(),
    campaignId: z.string(),
    campaignPostId: z.string(),
    contentHash: z.string().optional(),
    platform: z.enum(['twitter', 'instagram']),
    text: z.string(),
    mediaUrl: z.string().nullable().optional(),
    source: z.literal('campaign_manager'),
    scheduledAt: z.custom<{ toDate: () => Date }>(value => (
        typeof value === 'object'
        && value !== null
        && 'toDate' in value
        && typeof (value as { toDate?: unknown }).toDate === 'function'
    )),
    status: z.enum(['pending', 'delivering', 'delivered', 'failed']),
    retryCount: z.number().int().min(0).optional(),
    nextRetryAt: z.unknown().optional(),
    deliveryError: z.string().optional(),
});

type SupportedCampaignPlatform = 'Twitter' | 'Instagram';

function toDeliveryPlatform(platform: SupportedCampaignPlatform): 'twitter' | 'instagram' {
    return platform === 'Twitter' ? 'twitter' : 'instagram';
}

function scheduledTimeAsDate(value: z.infer<typeof ScheduledTimeSchema>): Date {
    return typeof value === 'object' && value !== null && 'toDate' in value
        ? value.toDate()
        : new Date(value as string | number | Date);
}

function scheduledAtForPost(post: z.infer<typeof ScheduledPostSchema>): admin.firestore.Timestamp {
    if (post.scheduledTime) {
        return admin.firestore.Timestamp.fromDate(scheduledTimeAsDate(post.scheduledTime));
    }

    const dayOffset = Math.max(0, (Number((post as { day?: number }).day) || 1) - 1);
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    return admin.firestore.Timestamp.fromDate(date);
}

function queueContentHash(post: z.infer<typeof ScheduledPostSchema>): string {
    return crypto.createHash('sha256').update(JSON.stringify({
        platform: post.platform,
        copy: post.copy,
        mediaUrl: post.imageAsset?.imageUrl || null,
        day: post.day ?? 1,
    })).digest('hex');
}

export function campaignQueueDocumentId(userId: string, campaignId: string, campaignPostId: string): string {
    return crypto.createHash('sha256')
        .update(`${userId}:${campaignId}:${campaignPostId}`)
        .digest('hex');
}

function campaignStatusForQueue(data: z.infer<typeof ExistingQueueSchema>): 'EXECUTING' | 'DONE' | 'FAILED' {
    if (data.status === 'delivered') return 'DONE';
    if (data.status === 'failed' && (data.retryCount ?? 0) >= 3 && !data.nextRetryAt) return 'FAILED';
    return 'EXECUTING';
}

export function normalizeDispatchPlatform(platform: unknown): 'twitter' | 'instagram' | 'tiktok' | 'youtube' {
    const normalized = String(platform || '').toLowerCase().trim();
    if (normalized === 'twitter' || normalized === 'x') return 'twitter';
    if (normalized === 'instagram' || normalized === 'ig' || normalized === 'meta_reels') return 'instagram';
    if (normalized === 'tiktok') return 'tiktok';
    // ISSUE-820: MultiPlatformPoster/SocialAutoPosterService send the raw
    // platform id 'youtube_shorts' verbatim in the dispatch payload, but the
    // scheduled-delivery worker (deliverScheduledPosts.ts) only recognizes
    // 'youtube' — this alias was previously rejected here before ever
    // reaching the worker.
    if (normalized === 'youtube' || normalized === 'youtube_shorts') return 'youtube';
    throw new HttpsError(
        "failed-precondition",
        `Social platform '${String(platform)}' is not wired for native delivery.`
    );
}

/**
 * Executes a social media campaign.
 * Queues supported posts for the scheduled social delivery worker.
 */
export const executeCampaign = onCall(
    { enforceAppCheck: true, timeoutSeconds: 60, memory: "512MiB", cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError("unauthenticated", "Auth required");
        }

        const validation = CampaignExecutionRequestSchema.safeParse(request.data);
        if (!validation.success) {
            throw new HttpsError("invalid-argument", validation.error.message);
        }

        const { campaignId, dryRun } = validation.data;

        console.log(`[Marketing] Executing Campaign ${campaignId} (DryRun: ${dryRun})`);

        const db = admin.firestore();
        const userId = request.auth.uid;
        const campaignRef = db.collection('campaigns').doc(campaignId);

        const readOwnedCampaign = (snapshot: admin.firestore.DocumentSnapshot) => {
            if (!snapshot.exists) {
                throw new HttpsError('not-found', 'Campaign not found.');
            }
            const parsed = PersistedCampaignSchema.safeParse(snapshot.data());
            if (!parsed.success) {
                console.error(`[Marketing] Campaign ${campaignId} has invalid persisted data`, parsed.error);
                throw new HttpsError('failed-precondition', 'Campaign data is invalid and cannot be queued.');
            }
            if (parsed.data.userId !== userId) {
                throw new HttpsError('permission-denied', 'Campaign does not belong to the authenticated user.');
            }
            return parsed.data;
        };

        if (dryRun) {
            const campaign = readOwnedCampaign(await campaignRef.get());
            return {
                success: true,
                posts: campaign.posts.map(post => post.scheduledTime
                    ? { ...post, scheduledTime: scheduledTimeAsDate(post.scheduledTime).toISOString() }
                    : post),
                status: campaign.status,
                message: "Persisted campaign validated; no posts were queued.",
            };
        }

        const queueResult = await db.runTransaction(async transaction => {
            const campaign = readOwnedCampaign(await transaction.get(campaignRef));
            const campaignPostIds = new Set(campaign.posts.map(post => post.id));
            const existingQueue = await transaction.get(
                db.collection('scheduledPosts').where('campaignId', '==', campaignId),
            );
            const existingByPostId = new Map<string, {
                ref: admin.firestore.DocumentReference;
                data: z.infer<typeof ExistingQueueSchema>;
            }>();

            for (const queueDocument of existingQueue.docs) {
                const parsed = ExistingQueueSchema.safeParse(queueDocument.data());
                if (!parsed.success
                    || parsed.data.userId !== userId
                    || !campaignPostIds.has(parsed.data.campaignPostId)
                    || existingByPostId.has(parsed.data.campaignPostId)) {
                    throw new HttpsError(
                        'failed-precondition',
                        'The existing campaign queue conflicts with the persisted campaign.',
                    );
                }
                existingByPostId.set(parsed.data.campaignPostId, {
                    ref: queueDocument.ref,
                    data: parsed.data,
                });
            }

            const entries = campaign.posts.map(post => {
                const id = campaignQueueDocumentId(userId, campaignId, post.id);
                const existing = existingByPostId.get(post.id);
                return {
                    post,
                    contentHash: queueContentHash(post),
                    scheduledAt: scheduledAtForPost(post),
                    existing: existing?.data,
                    ref: existing?.ref ?? db.collection('scheduledPosts').doc(id),
                };
            });
            let createdCount = 0;

            const queuedPosts = entries.map(entry => {
                let queueStatus: 'EXECUTING' | 'DONE' | 'FAILED' = 'EXECUTING';
                let scheduledAt = entry.scheduledAt;
                let deliveryError: string | undefined;

                if (entry.existing) {
                    const existingPlatform = toDeliveryPlatform(entry.post.platform as SupportedCampaignPlatform);
                    const mediaUrl = entry.post.imageAsset.imageUrl || null;
                    const currentQueueMatches = entry.existing.contentHash
                        ? entry.existing.contentHash === entry.contentHash
                            && entry.existing.scheduledAt.toDate().getTime() === entry.scheduledAt.toDate().getTime()
                        : entry.existing.platform === existingPlatform
                            && entry.existing.text === entry.post.copy
                            && (entry.existing.mediaUrl ?? null) === mediaUrl;

                    if (!currentQueueMatches) {
                        throw new HttpsError(
                            'failed-precondition',
                            `Post ${entry.post.id} already has a conflicting queue record.`,
                        );
                    }
                    queueStatus = campaignStatusForQueue(entry.existing);
                    scheduledAt = admin.firestore.Timestamp.fromDate(entry.existing.scheduledAt.toDate());
                    deliveryError = queueStatus === 'FAILED' ? entry.existing.deliveryError : undefined;
                } else {
                    const mediaUrl = entry.post.imageAsset.imageUrl;
                    transaction.set(entry.ref, {
                        userId,
                        campaignId,
                        campaignPostId: entry.post.id,
                        contentHash: entry.contentHash,
                        platform: toDeliveryPlatform(entry.post.platform as SupportedCampaignPlatform),
                        text: entry.post.copy,
                        mediaUrl: mediaUrl || null,
                        mediaType: mediaUrl ? 'image' : null,
                        scheduledAt: entry.scheduledAt,
                        status: 'pending',
                        source: 'campaign_manager',
                        retryCount: 0,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    createdCount += 1;
                }

                const queuedPost = {
                    ...entry.post,
                    postId: entry.ref.id,
                    status: queueStatus,
                    scheduledTime: scheduledAt.toDate().toISOString(),
                };
                if (deliveryError) queuedPost.errorMessage = deliveryError;
                else delete queuedPost.errorMessage;
                return queuedPost;
            });

            const status = queuedPosts.every(post => post.status === 'DONE')
                ? 'DONE' as const
                : queuedPosts.some(post => post.status === 'FAILED')
                    ? 'FAILED' as const
                    : 'EXECUTING' as const;

            transaction.update(campaignRef, {
                posts: queuedPosts,
                status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            return { queuedPosts, status, createdCount };
        });

        return {
            success: true,
            posts: queueResult.queuedPosts,
            status: queueResult.status,
            message: queueResult.createdCount === 0
                ? "Existing campaign queue confirmed; no duplicate posts were created."
                : `Campaign queue confirmed with ${queueResult.createdCount} new post${queueResult.createdCount === 1 ? '' : 's'}.`,
        };
    },
);

/**
 * Dispatches a specific media post to a social platform (TikTok, IG, YT).
 * Fulfills PRODUCTION_200:141.
 */
export const dispatchSocialPost = onCall(
    { region: "us-central1", enforceAppCheck: true, timeoutSeconds: 120, memory: "512MiB", cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

        const { mediaUrl, platform, caption } = (request.data ?? {}) as Record<string, unknown>;
        const normalizedPlatform = normalizeDispatchPlatform(platform);
        console.info(`[SocialPost] Queueing ${normalizedPlatform}: ${mediaUrl}`);

        const docRef = await admin.firestore().collection('scheduledPosts').add({
            userId: request.auth.uid,
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
    },
);

/**
 * Creates and persists a tracking link for an influencer.
 * Fulfills PRODUCTION_200:149.
 */
export const createInfluencerBounty = onCall(
    { region: "us-central1", enforceAppCheck: true, timeoutSeconds: 60, memory: "512MiB", cpu: 'gcf_gen1', concurrency: 1 },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Auth required");

        const { influencerHandle, trackName, rewardAmount: _rewardAmount, action } = (request.data ?? {}) as Record<string, unknown>;
        let bountyBaseUrl = process.env.INFLUENCER_BOUNTY_BASE_URL || '';
        if (!bountyBaseUrl) {
            try {
                bountyBaseUrl = influencerBountyBaseUrl.value();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                console.warn("influencerBountyBaseUrl parameter not set.");
            }
        }
        if (!bountyBaseUrl) {
            throw new HttpsError(
                "failed-precondition",
                "Influencer bounty base URL is not configured."
            );
        }

        const refCode = `REF-${crypto.randomUUID().split('-')[0].toUpperCase()}`;
        const link = `${bountyBaseUrl.replace(/\/$/, '')}/ref/${refCode}`;

        await admin.firestore().collection('influencerBounties').doc(refCode).set({
            userId: request.auth.uid,
            influencerHandle,
            trackName,
            rewardAmount: _rewardAmount ?? null,
            action: typeof action === 'string' ? action : null,
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
    },
);
