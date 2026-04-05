import { z } from 'zod';

export const CampaignSchema = z.object({
    id: z.string().optional(),
    artist: z.string().min(1, "Artist name is required"),
    title: z.string().min(1, "Campaign title is required"),
    type: z.enum(['Album', 'Single', 'Tour']),
    status: z.enum(['Draft', 'Live', 'Scheduled', 'Ended']).default('Draft'),
    progress: z.number().min(0).max(100).default(0),
    releaseDate: z.string(), // ISO Date string
    coverUrl: z.string().url().optional(),
    openRate: z.number().min(0).max(100).default(0),
    budget: z.number().min(0).default(0), // New field replacing mock estimation
    userId: z.string().optional(), // Often added by service
    createdAt: z.any().optional(), // Firestore Timestamp
    updatedAt: z.any().optional(), // Firestore Timestamp
});

export const ContactSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    outlet: z.string().min(1, "Outlet is required"),
    role: z.enum(['Journalist', 'Curator', 'Influencer', 'Editor']),
    tier: z.enum(['Top', 'Mid', 'Blog']),
    influenceScore: z.number().min(0).max(100).default(0),
    relationshipStrength: z.enum(['Strong', 'Neutral', 'Weak']).default('Neutral'),
    avatarUrl: z.string().url().optional(),
    notes: z.string().optional(),
    lastInteraction: z.string().optional(), // ISO Date string
    userId: z.string().optional(),
    createdAt: z.any().optional(),
    updatedAt: z.any().optional(),
});

export const PublicistStatsSchema = z.object({
    globalReach: z.string(),
    avgOpenRate: z.string(),
    placementValue: z.string(),
});

export type Campaign = z.infer<typeof CampaignSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type PublicistStats = z.infer<typeof PublicistStatsSchema>;
