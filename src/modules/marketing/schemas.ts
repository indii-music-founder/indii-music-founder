import { z } from "zod";

export const CampaignStatusSchema = z.enum(['PENDING', 'EXECUTING', 'DONE', 'FAILED']);

export const ScheduledPostSchema = z.object({
    id: z.string(),
    platform: z.enum(['Twitter', 'Instagram', 'LinkedIn']),
    copy: z.string(),
    // Simple date validation or string if coming from JSON
    scheduledTime: z.union([z.date(), z.string()]).optional(),
    status: CampaignStatusSchema,
});

export const CampaignExecutionRequestSchema = z.object({
    campaignId: z.string().uuid().or(z.string()), // Allow UUID or Firestore ID
    posts: z.array(ScheduledPostSchema),
    dryRun: z.boolean().optional().default(false),
});

export type CampaignExecutionRequest = z.infer<typeof CampaignExecutionRequestSchema>;
