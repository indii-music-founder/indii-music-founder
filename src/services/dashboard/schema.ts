import { z } from 'zod';

// Schema for a single metric with value and trend
export const MetricSchema = z.object({
    value: z.number(),
    change: z.number().optional(), // Percentage change (e.g., 0.5 for +0.5%)
    trend: z.enum(['up', 'down', 'neutral']).default('neutral'),
    formatted: z.string().optional(), // Pre-formatted string if needed (e.g. "$24.00")
});

export type Metric = z.infer<typeof MetricSchema>;

// Schema for the sales analytics data
export const SalesAnalyticsSchema = z.object({
    conversionRate: MetricSchema,
    totalVisitors: MetricSchema,
    clickRate: MetricSchema,
    avgOrderValue: MetricSchema,
    revenueChart: z.array(z.number()), // Simplified for the current chart implementation
    period: z.string().default('30d'),
    lastUpdated: z.number().optional(), // Timestamp
});

export type SalesAnalyticsData = z.infer<typeof SalesAnalyticsSchema>;

// Schema for the dashboard revenue MTD data
export const DashboardRevenueStatsSchema = z.object({
    mtdRevenue: MetricSchema,
    totalRevenue: MetricSchema,
    pendingPayouts: MetricSchema,
    lastPayout: MetricSchema,
    period: z.string().default('mtd'),
    lastUpdated: z.number().optional(),
});

export type DashboardRevenueStats = z.infer<typeof DashboardRevenueStatsSchema>;
// Schema for the dashboard streams today data
export const DashboardStreamsStatsSchema = z.object({
    streamsToday: MetricSchema,
    weeklyStreams: z.array(z.number()), // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    period: z.string().default('daily'),
    lastUpdated: z.number().optional(),
});

export type DashboardStreamsStats = z.infer<typeof DashboardStreamsStatsSchema>;
