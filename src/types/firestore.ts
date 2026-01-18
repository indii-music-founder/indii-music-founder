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
    status: 'processing' | 'staged' | 'packaged' | 'delivering' | 'completed' | 'failed';

    // Metadata Snapshot
    title?: string;
    artist?: string;
    coverArtUrl?: string;

    // External IDs
    externalId?: string;
    distributorReleaseId?: string;

    // Track Dates as Timestamps
    submittedAt: Timestamp;
    lastCheckedAt: Timestamp;

    // Support for distribution/types/distributor.ts types indirectly
    errors?: any[];
    warnings?: string[];
    territories?: string[];
    projectedReleaseDate?: string;
    trackingLink?: string;
}
