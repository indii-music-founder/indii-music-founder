/**
 * DDEX DSR (Digital Sales Reporting) Types
 * For processing royalty reports from DSPs
 */

import type { DateRange, Price, TerritoryCode } from './common';

// DSR Report - usage/sales report from a DSP
export interface DSRReport {
  reportId: string;
  senderId: string;   // DSP Party ID
  recipientId: string; // Our DPID
  reportingPeriod: DateRange;
  reportCreatedDateTime: string;
  currencyCode: string;  // ISO 4217

  // Summary totals
  summary: DSRSummary;

  // Individual transactions
  transactions: DSRTransaction[];
}

export interface DSRSummary {
  totalUsageCount: number;
  totalRevenue: number;
  totalStreams?: number;
  totalDownloads?: number;
  currencyCode: string;
}

// Individual usage/sales transaction
export interface DSRTransaction {
  transactionId: string;
  resourceId: ResourceIdentifier;
  releaseId?: ReleaseIdentifier;

  // Usage details
  usageType: DSRUsageType;
  usageCount: number;

  // Revenue
  revenueAmount: number;
  currencyCode: string;

  // Territory
  territoryCode: TerritoryCode;

  // Service/Platform details
  serviceName?: string;
  serviceType?: 'Streaming' | 'Download' | 'Other';

  // Time period (may differ from report period)
  usagePeriod?: DateRange;

  // Subscriber type
  subscriberType?: 'Premium' | 'AdSupported' | 'Free' | 'Trial';
}

export interface ResourceIdentifier {
  isrc?: string;
  proprietaryId?: string;
  title?: string;
}

export interface ReleaseIdentifier {
  icpn?: string;  // UPC/EAN
  gridId?: string;
  proprietaryId?: string;
}

export type DSRUsageType =
  | 'OnDemandStream'
  | 'ProgrammedStream'
  | 'Download'
  | 'RingtoneDownload'
  | 'Other';

// Processed royalty calculation
export interface RoyaltyCalculation {
  releaseId: string;
  resourceId: string;
  isrc: string;

  // Aggregated usage
  totalStreams: number;
  totalDownloads: number;

  // Revenue breakdown
  grossRevenue: number;
  platformFees: number;
  distributorFees: number;
  netRevenue: number;

  // Per-contributor splits
  contributorPayments: ContributorPayment[];

  // Period
  period: DateRange;
  currencyCode: string;
}

export interface ContributorPayment {
  contributorId: string;
  contributorName: string;
  role: string;
  splitPercentage: number;
  grossAmount: number;
  netAmount: number;
  paymentStatus: 'pending' | 'processing' | 'paid' | 'failed';
}

// DSR File parsing result
export interface DSRParseResult {
  success: boolean;
  report?: DSRReport;
  errors?: DSRParseError[];
  warnings?: string[];
}

export interface DSRParseError {
  line?: number;
  column?: number;
  code: string;
  message: string;
}

// DSR Processing options
export interface DSRProcessingOptions {
  autoMatchReleases?: boolean;  // Match transactions to our releases
  calculateRoyalties?: boolean;  // Auto-calculate contributor splits
  aggregateByRelease?: boolean;  // Group transactions by release
  currencyConversion?: {
    targetCurrency: string;
    exchangeRates: Record<string, number>;
  };
}

// Earnings summary for UI display
export interface EarningsSummary {
  period: DateRange;
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalStreams: number;
  totalDownloads: number;
  currencyCode: string;

  // Breakdown by source
  byPlatform: PlatformEarnings[];
  byTerritory: TerritoryEarnings[];
  byRelease: ReleaseEarnings[];
}

export interface PlatformEarnings {
  platformName: string;
  streams: number;
  downloads: number;
  revenue: number;
}

export interface TerritoryEarnings {
  territoryCode: string;
  territoryName: string;
  streams: number;
  downloads: number;
  revenue: number;
}

export interface ReleaseEarnings {
  releaseId: string;
  releaseName: string;
  isrc?: string;
  streams: number;
  downloads: number;
  revenue: number;
}
