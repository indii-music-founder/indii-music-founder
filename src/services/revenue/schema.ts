import { z } from 'zod';

export const RevenueEntrySchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  productName: z.string().optional(),
  amount: z.number().default(0),
  currency: z.string().default('USD'),
  source: z.string().default('other'),
  customerId: z.string().optional(),
  userId: z.string(),
  status: z.enum(['completed', 'pending', 'failed']).default('completed'),
  timestamp: z.number().optional(),
  // Firestore timestamps can be complex, so we check if it's an object with toDate or similar, or just allow any for now
  createdAt: z.any().optional(),
});

export type RevenueEntry = z.infer<typeof RevenueEntrySchema>;

export const RevenueStatsSchema = z.object({
  totalRevenue: z.number(),
  revenueChange: z.number(),
  pendingPayouts: z.number(),
  lastPayoutAmount: z.number(),
  lastPayoutDate: z.date().optional(),
  sources: z.object({
    streaming: z.number(),
    merch: z.number(),
    licensing: z.number(),
    social: z.number(),
  }),
  sourceCounts: z.object({
    streaming: z.number(),
    merch: z.number(),
    licensing: z.number(),
    social: z.number(),
  }),
  revenueByProduct: z.record(z.string(), z.number()),
  salesByProduct: z.record(z.string(), z.number()),
  history: z.array(z.object({
    date: z.string(),
    amount: z.number(),
  })),
});

export type RevenueStats = z.infer<typeof RevenueStatsSchema>;
export const PlatformEarningsSchema = z.object({
  platformName: z.string(),
  streams: z.number().default(0),
  downloads: z.number().default(0),
  revenue: z.number().default(0),
});

export const TerritoryEarningsSchema = z.object({
  territoryCode: z.string(),
  territoryName: z.string(),
  streams: z.number().default(0),
  downloads: z.number().default(0),
  revenue: z.number().default(0),
});

export const ReleaseEarningsSchema = z.object({
  releaseId: z.string(),
  releaseName: z.string(),
  isrc: z.string().optional(),
  streams: z.number().default(0),
  downloads: z.number().default(0),
  revenue: z.number().default(0),
});

export const EarningsSummarySchema = z.object({
  userId: z.string().optional(),
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
  }),
  totalGrossRevenue: z.number().default(0),
  totalNetRevenue: z.number().default(0),
  totalStreams: z.number().default(0),
  totalDownloads: z.number().default(0),
  currencyCode: z.string().default('USD'),
  byPlatform: z.array(PlatformEarningsSchema).default([]),
  byTerritory: z.array(TerritoryEarningsSchema).default([]),
  byRelease: z.array(ReleaseEarningsSchema).default([]),
  createdAt: z.any().optional(),
});

export type PlatformEarnings = z.infer<typeof PlatformEarningsSchema>;
export type TerritoryEarnings = z.infer<typeof TerritoryEarningsSchema>;
export type ReleaseEarnings = z.infer<typeof ReleaseEarningsSchema>;
export type EarningsSummary = z.infer<typeof EarningsSummarySchema>;
