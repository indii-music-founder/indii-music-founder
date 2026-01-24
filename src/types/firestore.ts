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
    errors?: any[];
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
