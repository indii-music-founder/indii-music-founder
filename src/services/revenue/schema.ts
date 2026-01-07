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
