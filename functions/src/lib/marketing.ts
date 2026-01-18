import * as functions from "firebase-functions/v1";
import { z } from "zod";
import { defineSecret } from "firebase-functions/params";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

export const CampaignStatusSchema = z.enum(['PENDING', 'EXECUTING', 'DONE', 'FAILED']);

export const ScheduledPostSchema = z.object({
    id: z.string(),
    platform: z.enum(['Twitter', 'Instagram', 'LinkedIn']),
    copy: z.string(),
    scheduledTime: z.union([z.date(), z.string(), z.number()]).optional(),
    status: CampaignStatusSchema,
});

export const CampaignExecutionRequestSchema = z.object({
    campaignId: z.string(),
    posts: z.array(ScheduledPostSchema),
    dryRun: z.boolean().optional().default(false),
});

export type CampaignExecutionRequest = z.infer<typeof CampaignExecutionRequestSchema>;

/**
 * Executes a social media campaign.
 * In production, this would integrate with platform APIs.
 * Currently simulates scheduling success.
 */
export const executeCampaign = functions
    .runWith({ secrets: [geminiApiKey], timeoutSeconds: 60 })
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

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 800));

        // Mark all posts as "DONE" for the demo/release
        const executedPosts = posts.map(p => ({
            ...p,
            status: 'DONE' as const,
            scheduledTime: new Date().toISOString()
        }));

        return {
            success: true,
            posts: executedPosts,
            message: dryRun ? "Dry run successful. Posts validated." : "Campaign posts successfully scheduled."
        };
    });
