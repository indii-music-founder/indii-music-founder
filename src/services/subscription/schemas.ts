import { z } from 'zod';
import { SubscriptionTier } from './SubscriptionTier';

export const SubscriptionTierSchema = z.nativeEnum(SubscriptionTier);

export const SubscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tier: SubscriptionTierSchema,
  status: z.enum(['active', 'past_due', 'canceled', 'trialing', 'incomplete']),
  currentPeriodStart: z.number(),
  currentPeriodEnd: z.number(),
  cancelAtPeriodEnd: z.boolean(),
  trialEnd: z.number().optional(),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  cancelReason: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const UsageStatsSchema = z.object({
  userId: z.string().optional(),
  tier: SubscriptionTierSchema,
  resetDate: z.number(),

  // Image usage
  imagesGenerated: z.number(),
  imagesRemaining: z.number(),
  imagesPerMonth: z.number(),

  // Video usage
  videoDurationSeconds: z.number(),
  videoDurationMinutes: z.number(),
  videoRemainingMinutes: z.number(),
  videoTotalMinutes: z.number(),

  // Chat tokens
  aiChatTokensUsed: z.number(),
  aiChatTokensRemaining: z.number(),
  aiChatTokensPerMonth: z.number(),

  // Storage
  storageUsedGB: z.number(),
  storageRemainingGB: z.number(),
  storageTotalGB: z.number(),

  // Projects
  projectsCreated: z.number(),
  projectsRemaining: z.number(),
  maxProjects: z.number(),

  // Team members
  teamMembersUsed: z.number(),
  teamMembersRemaining: z.number(),
  maxTeamMembers: z.number(),
});

export const UsageRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  subscriptionId: z.string(),
  project: z.string().optional(),
  type: z.enum(['image', 'video', 'chat_tokens', 'storage', 'export', 'upload']),
  amount: z.number(),
  timestamp: z.number(),
  metadata: z.record(z.any()).optional(),
});
