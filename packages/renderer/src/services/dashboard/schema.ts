import { z } from 'zod';

// ── Shared Primitives ─────────────────────────────────────────────────────────

/** A single KPI value with optional trend indicator and formatted display string. */
export const MetricSchema = z.object({
    value: z.number(),
    change: z.number().optional(),       // Percentage change, e.g. 0.5 for +0.5%
    trend: z.enum(['up', 'down', 'neutral']).default('neutral'),
    formatted: z.string().optional(),   // Pre-formatted string, e.g. "$24.00"
});

export type Metric = z.infer<typeof MetricSchema>;

// ── Sales Analytics (Publishing Dashboard) ────────────────────────────────────

export const SalesAnalyticsSchema = z.object({
    conversionRate: MetricSchema,
    totalVisitors: MetricSchema,
    clickRate: MetricSchema,
    avgOrderValue: MetricSchema,
    revenueChart: z.array(z.number()),
    period: z.string().default('30d'),
    lastUpdated: z.number().optional(),
});

export type SalesAnalyticsData = z.infer<typeof SalesAnalyticsSchema>;

// ── Revenue MTD Widget ────────────────────────────────────────────────────────

export const DashboardRevenueStatsSchema = z.object({
    mtdRevenue: MetricSchema,
    totalRevenue: MetricSchema,
    pendingPayouts: MetricSchema,
    lastPayout: MetricSchema,
    period: z.string().default('mtd'),
    lastUpdated: z.number().optional(),
});

export type DashboardRevenueStats = z.infer<typeof DashboardRevenueStatsSchema>;

// ── Streams Today Widget ──────────────────────────────────────────────────────

export const DashboardStreamsStatsSchema = z.object({
    streamsToday: MetricSchema,
    weeklyStreams: z.array(z.number()), // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    period: z.string().default('daily'),
    lastUpdated: z.number().optional(),
});

export type DashboardStreamsStats = z.infer<typeof DashboardStreamsStatsSchema>;

// ── Audience Growth Widget ────────────────────────────────────────────────────

export const DashboardAudienceStatsSchema = z.object({
    newListenersThisWeek: MetricSchema,
    totalFollowers: MetricSchema,
    weeklyGrowth: z.array(z.number()), // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    platforms: z.array(z.object({
        name: z.string(),
        followers: z.number(),
        change: z.number(),
    })).optional(),
    period: z.string().default('weekly'),
    lastUpdated: z.number().optional(),
});

export type DashboardAudienceStats = z.infer<typeof DashboardAudienceStatsSchema>;

// ── Top Track Widget ──────────────────────────────────────────────────────────

export const DashboardTopTrackSchema = z.object({
    title: z.string(),
    artistName: z.string().optional(),
    coverUrl: z.string().optional(),
    streams: MetricSchema,
    revenue: MetricSchema,
    saveRate: MetricSchema,      // % of listeners who saved the track
    trend: z.enum(['rising', 'stable', 'falling']).default('stable'),
    lastUpdated: z.number().optional(),
});

export type DashboardTopTrack = z.infer<typeof DashboardTopTrackSchema>;

// ── Next Release Widget ───────────────────────────────────────────────────────

export const DashboardNextReleaseSchema = z.object({
    title: z.string(),
    releaseDate: z.number(),         // Unix timestamp (ms)
    distributors: z.array(z.string()),
    status: z.enum(['draft', 'submitted', 'approved', 'live']).default('draft'),
    coverUrl: z.string().optional(),
    lastUpdated: z.number().optional(),
});

export type DashboardNextRelease = z.infer<typeof DashboardNextReleaseSchema>;

// ── Agent Activity Widget ─────────────────────────────────────────────────────

export const AgentTaskSchema = z.object({
    id: z.string(),
    agentName: z.string(),
    taskLabel: z.string(),
    status: z.enum(['running', 'completed', 'failed', 'pending']),
    completedAt: z.number().optional(),
    createdAt: z.number(),
});

export const DashboardAgentActivitySchema = z.object({
    recentTasks: z.array(AgentTaskSchema),
    runningCount: z.number().default(0),
    completedToday: z.number().default(0),
    lastUpdated: z.number().optional(),
});

export type AgentTask = z.infer<typeof AgentTaskSchema>;
export type DashboardAgentActivity = z.infer<typeof DashboardAgentActivitySchema>;

// ── Active Campaigns Widget ───────────────────────────────────────────────────

export const DashboardActiveCampaignsSchema = z.object({
    activeCount: z.number().default(0),
    totalBudget: MetricSchema,
    topCampaign: z.object({
        name: z.string(),
        platform: z.string(),
        spend: z.number(),
    }).optional(),
    lastUpdated: z.number().optional(),
});

export type DashboardActiveCampaigns = z.infer<typeof DashboardActiveCampaignsSchema>;

// ── Pending Tasks Widget ──────────────────────────────────────────────────────

export const DashboardPendingTaskSchema = z.object({
    id: z.string(),
    title: z.string(),
    module: z.string(),           // e.g. 'distribution', 'marketing', 'legal'
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    createdAt: z.number(),
});

export const DashboardPendingTasksSchema = z.object({
    tasks: z.array(DashboardPendingTaskSchema),
    totalCount: z.number().default(0),
    lastUpdated: z.number().optional(),
});

export type DashboardPendingTask = z.infer<typeof DashboardPendingTaskSchema>;
export type DashboardPendingTasks = z.infer<typeof DashboardPendingTasksSchema>;

// ── Social Engagement Widget ──────────────────────────────────────────────────

export const DashboardSocialEngagementSchema = z.object({
    engagementRate: MetricSchema,
    weeklyEngagement: z.array(z.number()), // [Mon..Sun]
    totalInteractions: MetricSchema,
    lastUpdated: z.number().optional(),
});

export type DashboardSocialEngagement = z.infer<typeof DashboardSocialEngagementSchema>;

// ── Brand Identity Widget ─────────────────────────────────────────────────────

export const DashboardBrandIdentitySchema = z.object({
    complianceScore: MetricSchema,          // 0–100%
    assetsStatus: z.enum(['synced', 'outdated', 'missing']).default('synced'),
    lastAudit: z.number().optional(),       // timestamp of last brand audit
    issues: z.number().default(0),          // outstanding brand issues
    lastUpdated: z.number().optional(),
});

export type DashboardBrandIdentity = z.infer<typeof DashboardBrandIdentitySchema>;

// ── Merch Sales Widget ────────────────────────────────────────────────────────

export const DashboardMerchSalesSchema = z.object({
    weeklyRevenue: MetricSchema,
    totalOrders: MetricSchema,
    topProduct: z.object({
        name: z.string(),
        unitsSold: z.number(),
    }).optional(),
    lowStockAlerts: z.number().default(0),
    lastUpdated: z.number().optional(),
});

export type DashboardMerchSales = z.infer<typeof DashboardMerchSalesSchema>;

// ── Tour Status Widget ────────────────────────────────────────────────────────

export const DashboardTourStatusSchema = z.object({
    upcomingShows: z.number().default(0),
    nextShow: z.object({
        venue: z.string(),
        city: z.string(),
        date: z.number(),        // timestamp
        ticketsSold: z.number(),
        capacity: z.number(),
    }).optional(),
    totalTicketRevenue: MetricSchema,
    lastUpdated: z.number().optional(),
});

export type DashboardTourStatus = z.infer<typeof DashboardTourStatusSchema>;
