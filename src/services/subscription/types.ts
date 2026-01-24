/**
 * Type definitions for subscription and usage tracking
 */

import { SubscriptionTier } from './SubscriptionTier';
export { SubscriptionTier };

/**
 * User subscription record
 */
export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  trialEnd?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelReason?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Usage statistics for current billing period
 */
export interface UsageStats {
  userId?: string;
  /** Current subscription tier */
  tier: SubscriptionTier;

  /** Reset date (timestamp) */
  resetDate: number;


  /** Image generation usage */
  imagesGenerated: number;
  imagesRemaining: number;
  imagesPerMonth: number;

  /** Video generation usage */
  videoDurationSeconds: number;
  videoDurationMinutes: number;
  videoRemainingMinutes: number;
  videoTotalMinutes: number;

  /** AI chat token usage */
  aiChatTokensUsed: number;
  aiChatTokensRemaining: number;
  aiChatTokensPerMonth: number;

  /** Storage usage */
  storageUsedGB: number;
  storageRemainingGB: number;
  storageTotalGB: number;

  /** Project usage */
  projectsCreated: number;
  projectsRemaining: number;
  maxProjects: number;

  /** Team member usage */
  teamMembersUsed: number;
  teamMembersRemaining: number;
  maxTeamMembers: number;
}

/**
 * Usage record for tracking individual actions
 */
export interface UsageRecord {
  id: string;
  userId: string;
  subscriptionId: string;
  project?: string;

  type: 'image' | 'video' | 'chat_tokens' | 'storage' | 'export' | 'upload';
  amount: number;

  timestamp: number;
  metadata?: {
    prompt?: string;
    resolution?: string;
    duration?: number;
    fileSize?: number;
    format?: string;
    model?: string;
    [key: string]: any;
  };
}

/**
 * Quota check result
 */
export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
  suggestedTier?: SubscriptionTier;
  upgradeUrl?: string;
  currentUsage?: {
    used: number;
    limit: number;
    remaining: number;
  };
}

/**
 * Usage history for charts and analytics
 */
export interface UsageHistory {
  period: 'daily' | 'weekly' | 'monthly';
  data: {
    date: string;
    images: number;
    videoMinutes: number;
    tokens: number;
    storageGB: number;
  }[];
}

/**
 * Usage analytics summary
 */
export interface UsageAnalytics {
  totalImagesGenerated: number;
  totalVideoMinutes: number;
  totalTokensUsed: number;
  totalStorageUsedGB: number;
  averageDailyImages: number;
  averageDailyVideoMinutes: number;
  topActionTypes: { type: string; count: number }[];
  mostUsedFeatures: { feature: string; usage: number }[];
}

/**
 * Subscription change request
 */
export interface SubscriptionChangeRequest {
  currentTier: SubscriptionTier;
  newTier: SubscriptionTier;
  effectiveDate: number;
  proratedCost?: number;
  creditAmount?: number;
}

/**
 * Checkout session options
 */
export interface CheckoutSessionParams {
  userId: string;
  tier: SubscriptionTier;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  trialDays?: number;
}

/**
 * Checkout session response
 */
export interface CheckoutSessionResponse {
  checkoutUrl: string;
  sessionId: string;
}

/**
 * Usage warning levels
 */
export enum UsageWarningLevel {
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
  EXCEEDED = 'exceeded'
}

/**
 * Usage warning for UI notifications
 */
export interface UsageWarning {
  type: 'image' | 'video' | 'chat' | 'storage';
  level: UsageWarningLevel;
  message: string;
  percentage: number;
  actionUrl?: string;
  upgradeUrl?: string;
  dismissible: boolean;
}

/**
 * Billing period summary
 */
export interface BillingPeriodSummary {
  periodStart: number;
  periodEnd: number;
  totalImages: number;
  totalVideoMinutes: number;
  totalTokens: number;
  totalCost: number;
  paymentStatus: 'paid' | 'pending' | 'failed';
  invoiceUrl?: string;
}
