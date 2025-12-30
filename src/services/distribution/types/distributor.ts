/**
 * Distribution Service Types
 * Unified interface for interacting with music distributors
 */

import type { ExtendedGoldenMetadata } from '@/services/metadata/types';
export type { ExtendedGoldenMetadata };
import type { DateRange, ValidationResult, ValidationError } from '@/services/ddex/types/common';

// Re-export specific DDEX types needed by consumers
export type { ValidationResult, ValidationError };

// Supported distributors
export type DistributorId =
  | 'distrokid'
  | 'tunecore'
  | 'cdbaby'
  | 'ditto'
  | 'awal'
  | 'unitedmasters'
  | 'amuse'
  | 'symphonic';

// ... (existing code)

// Multi-distributor release request
export interface MultiDistributorReleaseRequest {
  metadata: ExtendedGoldenMetadata;
  assets: ReleaseAssets;
  distributors: DistributorId[];
  releaseDate: string;
  territories: string[];
  options?: {
    autoSelectBestDistributor?: boolean;
    prioritizePayoutRate?: boolean;
    skipFailedDistributors?: boolean;
  };
}

// Release assets required for distribution
export interface ReleaseAssets {
  // Support multiple audio files for multi-track releases
  audioFiles: {
    trackIndex?: number; // Optional: Explicit mapping to metadata track index
    url: string;
    mimeType: string;
    sizeBytes: number;
    format: 'wav' | 'flac' | 'mp3' | 'aac';
    sampleRate: number;
    bitDepth: number;
  }[];
  // Deprecated: Singular audioFile for backward compatibility (optional)
  audioFile?: {
    url: string;
    mimeType: string;
    sizeBytes: number;
    format: 'wav' | 'flac' | 'mp3' | 'aac';
    sampleRate: number;
    bitDepth: number;
  };
  coverArt: {
    url: string;
    mimeType: string;
    width: number;
    height: number;
    sizeBytes: number;
  };
  additionalAssets?: {
    type: 'lyrics' | 'video' | 'pressKit';
    url: string;
    mimeType: string;
  }[];
}

// Release creation result
export interface ReleaseResult {
  success: boolean;
  releaseId?: string;
  distributorReleaseId?: string;
  status: ReleaseStatus;
  errors?: DistributorError[];
  metadata?: {
    estimatedLiveDate?: string;
    reviewRequired?: boolean;
    upcAssigned?: string;
    isrcAssigned?: string;
  };
}

// Release status across lifecycle
export type ReleaseStatus =
  | 'draft'
  | 'validating'
  | 'pending_review'
  | 'in_review'
  | 'approved'
  | 'processing'
  | 'delivering'
  | 'delivered'
  | 'live'
  | 'takedown_requested'
  | 'taken_down'
  | 'failed'
  | 'rejected';

// Distributor-specific error
export interface DistributorError {
  code: string;
  message: string;
  field?: string;
  distributorCode?: string;
}

// Earnings from a distributor
export interface DistributorEarnings {
  distributorId: DistributorId;
  releaseId: string;
  period: DateRange;
  streams: number;
  downloads: number;
  grossRevenue: number;
  distributorFee: number;
  netRevenue: number;
  currencyCode: string;
  breakdown?: EarningsBreakdown[];
  lastUpdated: string;
}

export interface EarningsBreakdown {
  platform: string;  // Spotify, Apple Music, etc.
  territoryCode: string;
  streams: number;
  downloads: number;
  revenue: number;
}

// Distributor requirements for validation
export interface DistributorRequirements {
  distributorId: DistributorId;
  coverArt: {
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
    aspectRatio: '1:1';
    allowedFormats: ('jpg' | 'png')[];
    maxSizeBytes: number;
    colorMode: 'RGB';
  };
  audio: {
    allowedFormats: ('wav' | 'flac' | 'mp3' | 'aac' | 'aiff')[];
    minSampleRate: number;
    recommendedSampleRate: number;
    minBitDepth: number;
    channels: 'stereo' | 'mono' | 'both';
    maxDurationSeconds?: number;
    minDurationSeconds?: number;
  };
  metadata: {
    requiredFields: string[];
    maxTitleLength: number;
    maxArtistNameLength: number;
    isrcRequired: boolean;
    upcRequired: boolean;
    genreRequired: boolean;
    languageRequired: boolean;
  };
  timing: {
    minLeadTimeDays: number;
    reviewTimeDays: number;
  };
  pricing: {
    model: 'subscription' | 'per_release' | 'free' | 'revenue_share';
    costPerRelease?: number;
    annualFee?: number;
    payoutPercentage: number;
  };
}

// Multi-distributor release request
export interface MultiDistributorReleaseRequest {
  metadata: ExtendedGoldenMetadata;
  assets: ReleaseAssets;
  distributors: DistributorId[];
  releaseDate: string;
  territories: string[];
  options?: {
    autoSelectBestDistributor?: boolean;
    prioritizePayoutRate?: boolean;
    skipFailedDistributors?: boolean;
  };
}

// Multi-distributor release result
export interface MultiDistributorReleaseResult {
  overallSuccess: boolean;
  results: Record<DistributorId, ReleaseResult>;
  summary: {
    totalDistributors: number;
    successCount: number;
    failedCount: number;
    pendingCount: number;
  };
}

// Aggregated earnings across all distributors
export interface AggregatedEarnings {
  releaseId: string;
  period: DateRange;
  totalStreams: number;
  totalDownloads: number;
  totalGrossRevenue: number;
  totalFees: number;
  totalNetRevenue: number;
  currencyCode: string;
  byDistributor: DistributorEarnings[];
  byPlatform: {
    platform: string;
    streams: number;
    downloads: number;
    revenue: number;
  }[];
  byTerritory: {
    territoryCode: string;
    streams: number;
    downloads: number;
    revenue: number;
  }[];
}

// Distributor connection status
export interface DistributorConnection {
  distributorId: DistributorId;
  isConnected: boolean;
  accountId?: string;
  accountEmail?: string;
  lastSyncedAt?: string;
  authExpiresAt?: string;
  features: {
    canCreateRelease: boolean;
    canUpdateRelease: boolean;
    canTakedown: boolean;
    canFetchEarnings: boolean;
    canFetchAnalytics: boolean;
  };
}

// Distributor adapter interface
export interface IDistributorAdapter {
  readonly id: DistributorId;
  readonly name: string;
  readonly requirements: DistributorRequirements;

  // Connection
  isConnected(): Promise<boolean>;
  connect(credentials: DistributorCredentials): Promise<void>;
  disconnect(): Promise<void>;

  // Release Management
  createRelease(metadata: ExtendedGoldenMetadata, assets: ReleaseAssets): Promise<ReleaseResult>;
  updateRelease(releaseId: string, updates: Partial<ExtendedGoldenMetadata>): Promise<ReleaseResult>;
  getReleaseStatus(releaseId: string): Promise<ReleaseStatus>;
  takedownRelease(releaseId: string): Promise<ReleaseResult>;

  // Earnings
  getEarnings(releaseId: string, period: DateRange): Promise<DistributorEarnings>;
  getAllEarnings(period: DateRange): Promise<DistributorEarnings[]>;

  // Validation
  validateMetadata(metadata: ExtendedGoldenMetadata): Promise<ValidationResult>;
  validateAssets(assets: ReleaseAssets): Promise<ValidationResult>;
}

// Credentials for connecting to distributors
export interface DistributorCredentials {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
  username?: string;
  password?: string;
  sftpHost?: string;
  sftpPort?: string;
  sftpUsername?: string;
  sftpPassword?: string;
  privateKey?: string;
}

// Release summary for dashboard display
export interface DashboardRelease {
  id: string;
  title: string;
  artist: string;
  coverArtUrl?: string;
  releaseDate?: string;
  deployments: Record<string, { status: ReleaseStatus; error?: string }>;
}
