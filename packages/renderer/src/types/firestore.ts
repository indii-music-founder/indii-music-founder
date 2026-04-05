import { Timestamp } from 'firebase/firestore';

/**
 * Base document fields included in all collections via FirestoreService
 */
export interface BaseDocument {
    id: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * Distribution Task Document
 * Collection: distribution_tasks
 */
export interface DistributionTaskDocument extends BaseDocument {
    userId: string;
    type: 'QC' | 'STAGING' | 'PACKAGING' | 'DELIVERY';
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    progress: number;
    title: string;
    subtext?: string;
    error?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Release Deployment Document
 * Collection: deployments
 */
export interface ReleaseDeploymentDocument extends BaseDocument {
    internalReleaseId: string;
    userId: string;
    orgId: string;
    distributorId: string;
    status: 'validating' | 'pending_review' | 'in_review' | 'processing' | 'submitted' | 'failed' | 'delivered' | 'live' | 'takedown_pending' | 'takedown_complete';
    externalId?: string;
    submittedAt?: Timestamp;
    lastCheckedAt?: Timestamp;
    title?: string;
    artist?: string;
    coverArtUrl?: string;
    // Support for distribution/types/distributor.ts types indirectly
    errors?: unknown[];
    warnings?: string[];
    territories?: string[];
    projectedReleaseDate?: string;
    trackingLink?: string;
}

/**
 * ISRC Record: Tracks assigned ISRCs to prevent duplicates and maintain registry
 * Collection: isrc_registry
 */
export interface ISRCRecordDocument extends BaseDocument {
    isrc: string;
    releaseId: string;
    userId: string;
    trackTitle: string;
    artistName: string;
    assignedAt: Timestamp;
    metadataSnapshot?: Record<string, unknown>;
}

/**
 * Tax Profile: User compliance data for international withholding
 * Collection: tax_profiles
 */
export interface TaxProfileDocument extends BaseDocument {
    userId: string;
    formType: 'W-9' | 'W-8BEN' | 'W-8BEN-E';
    country: string;
    tinMasked: string;
    tinEncrypted?: string; // Future: hardware-backed encryption
    tinValid: boolean;
    certified: boolean;
    payoutStatus: 'ACTIVE' | 'HELD';
    certTimestamp: Timestamp | null;
    metadata?: Record<string, unknown>;
}
import { ExtendedGoldenMetadata } from '@/services/metadata/types';

/**
 * Release Management (DDEX)
 * Collection: ddexReleases
 */
export type ReleaseDistributionStatus =
    | 'draft'
    | 'metadata_complete'
    | 'assets_uploaded'
    | 'validating'
    | 'pending_review'
    | 'approved'
    | 'delivering'
    | 'live'
    | 'takedown_requested'
    | 'taken_down';

export interface DDEXReleaseDocument extends BaseDocument {
    orgId: string;
    projectId: string;
    userId: string;
    status: ReleaseDistributionStatus;
    metadata: ExtendedGoldenMetadata;
    assets: {
        audioUrl: string;
        audioFormat: 'wav' | 'flac' | 'mp3';
        audioSampleRate: number;
        audioBitDepth: number;
        coverArtUrl: string;
        coverArtWidth: number;
        coverArtHeight: number;
    };
    distributors: {
        distributorId: string;
        releaseId?: string;
        status: string;
        submittedAt?: Timestamp;
        publishedAt?: Timestamp;
        error?: string;
    }[];
    submittedAt?: Timestamp;
    publishedAt?: Timestamp;
}

/**
 * Mechanical License: Tracks cover song clearances
 * Collection: mechanical_licenses/{userId}/licenses/{licenseId}
 */
export type MechanicalLicenseStatus =
    | 'pending_search'
    | 'rights_located'
    | 'license_requested'
    | 'license_active'
    | 'license_denied'
    | 'not_required';

export interface MechanicalLicenseDocument extends BaseDocument {
    userId: string;
    releaseId: string;
    trackTitle: string;
    isrc?: string;
    composition: {
        iswc?: string;
        title: string;
        writers: string[];
        publishers: string[];
        hfaCode?: string;
        controlled: boolean;
    };
    status: MechanicalLicenseStatus;
    distributionCopies: number;
    ratePerCopy: number;
    totalFee: number;
    licenseNumber?: string;
    requestedAt?: Timestamp;
    activatedAt?: Timestamp;
    expiresAt?: Timestamp;
    notes?: string;
}

/**
 * Earnings: Tracks revenue from DSPs
 * Collection: earnings
 */
export interface EarningsDocument extends BaseDocument {
    distributorId: string;
    releaseId: string;
    userId: string;
    period: {
        startDate: string;
        endDate: string;
    };
    streams: number;
    downloads: number;
    grossRevenue: number;
    distributorFee: number;
    netRevenue: number;
    platformFee?: number;
    currencyCode: string;
    matchedReleases: number;
    unmatchedISRCs: string[];
}

/**
 * Tour Vehicle Data
 */
export interface TourVehicleDocument {
    userId: string;
    milesDriven: number;
    fuelLevelPercent: number;
    tankSizeGallons: number;
    mpg: number;
    gasPricePerGallon: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * Tour Itinerary Data
 */
export interface TourItineraryStop {
    date: string;
    city: string;
    venue: string;
    activity: string;
    notes: string;
    type?: string;
    distance?: number;
}

export interface TourItineraryDocument {
    userId: string;
    tourName: string;
    stops: TourItineraryStop[];
    totalDistance: string;
    estimatedBudget: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

/**
 * DSR Processed Report: Stores history of uploaded sales reports
 * Collection: dsr_processed_reports
 */
export interface DSRProcessedReportDocument extends BaseDocument {
    userId: string;
    distributorId: string;
    batchId: string;
    reportId: string;
    totalRevenue: number;
    transactionCount: number;
    processedAt: Timestamp;
    reportPeriod: {
        start: string;
        end: string;
    };
    royaltiesSummary: {
        count: number;
        totalNetRevenue: number;
        totalGrossRevenue: number;
    };
    metadata: {
        createdAt: Timestamp;
        source: string;
    };
}
