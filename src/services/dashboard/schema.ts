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
