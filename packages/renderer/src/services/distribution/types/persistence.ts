import type { DistributorId, ReleaseStatus, ValidationError } from './distributor';

/**
 * Represents a single deployment of a release to a specific distributor.
 * Tracks the lifecycle of the release on that platform.
 */
export interface ReleaseDeployment {
    id: string; // Unique deployment ID (UUID)
    internalReleaseId: string; // Link to the GoldenMetadata/Album ID
    userId: string; // Owner of the deployment
    orgId: string; // Organization the deployment belongs to
    distributorId: DistributorId;
    status: ReleaseStatus;

    // Snapshot of Release Metadata (for UI display without full lookup)
    title?: string;
    artist?: string;
    coverArtUrl?: string;

    // External identifiers assigned by the distributor
    externalId?: string; // The distributor's internal ID for this release
    distributorReleaseId?: string; // standardized field name

    // Timestamps
    submittedAt: string; // ISO 8601
    lastCheckedAt: string; // ISO 8601
    lastUpdatedAt: string; // ISO 8601

    // Validation/Error tracking
    errors?: ValidationError[];
    warnings?: string[];

    // Deployment metadata
    territories?: string[];
    projectedReleaseDate?: string;
    trackingLink?: string; // URL to the release on the distributor's portal
}

/**
 * Filter options for querying deployments
 */
export interface DeploymentFilter {
    userId?: string;
    orgId?: string;
    distributorId?: DistributorId;
    internalReleaseId?: string;
    status?: ReleaseStatus;
    startDate?: string;
    endDate?: string;
}

/**
 * Schema for the local persistence store
 */
export interface DistributionStoreSchema {
    deployments: Record<string, ReleaseDeployment>; // Keyed by deployment ID
    // Index for quick lookups
    byInternalId: Record<string, string[]>; // internalReleaseId -> deploymentIds[]
}
