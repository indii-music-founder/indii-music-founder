import { z } from 'zod';

export const CreditTransactionTypeSchema = z.enum([
  'PURCHASE',
  'CONSUMPTION',
  'BONUS',
  'REFUND',
  'ADMIN_ADJUSTMENT',
]);
export type CreditTransactionType = z.infer<typeof CreditTransactionTypeSchema>;

export const CreditWalletSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  balanceCredits: z.number().int().nonnegative(),
  autoTopUp: z.boolean().default(false),
  autoTopUpThreshold: z.number().int().nonnegative().default(100),
  autoTopUpPackId: z.string().trim().optional(),
  currency: z.literal('USD').default('USD'),
  createdAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
}).strict();
export type CreditWallet = z.infer<typeof CreditWalletSchema>;

export const CreditTransactionSchema = z.object({
  id: z.string().trim().min(1).max(128),
  userId: z.string().trim().min(1).max(128),
  type: CreditTransactionTypeSchema,
  amountCredits: z.number().int(), // Positive for add, negative for deduction
  balanceAfter: z.number().int().nonnegative(),
  reason: z.string().trim().min(1).max(512),
  referenceId: z.string().trim().max(256).optional(),
  createdAt: z.number().nonnegative(),
}).strict();
export type CreditTransaction = z.infer<typeof CreditTransactionSchema>;

export const CreditPackSchema = z.object({
  id: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(128),
  credits: z.number().int().positive(),
  priceUsdCents: z.number().int().positive(),
  active: z.boolean().default(true),
}).strict();
export type CreditPack = z.infer<typeof CreditPackSchema>;

export const STANDARD_CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack_starter_500',
    name: 'Starter Pack',
    credits: 500,
    priceUsdCents: 500, // $5.00
    active: true,
  },
  {
    id: 'pack_growth_2500',
    name: 'Growth Pack',
    credits: 2500,
    priceUsdCents: 2000, // $20.00 (20% bonus)
    active: true,
  },
  {
    id: 'pack_power_10000',
    name: 'Power Pack',
    credits: 10000,
    priceUsdCents: 7000, // $70.00 (30% bonus)
    active: true,
  },
];
