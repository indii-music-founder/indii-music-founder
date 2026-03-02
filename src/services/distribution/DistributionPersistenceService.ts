import { auth } from '@/services/firebase';
import { FirestoreService } from '@/services/FirestoreService';
import { ReleaseDeploymentDocument } from '@/types/firestore';
import { Timestamp } from 'firebase/firestore';

export type { ReleaseDeploymentDocument as ReleaseDeployment };

export class DistributionPersistenceService extends FirestoreService<ReleaseDeploymentDocument> {
    constructor() {
        super('deployments');
    }

    /**
     * Records a new deployment or updates an existing one
     */
    async saveDeployment(deployment: ReleaseDeploymentDocument): Promise<void> {
        await this.set(deployment.id, deployment);
    }

    /**
     * Creates a new deployment record from a submission
     */
    async createDeployment(
        internalReleaseId: string,
        userId: string,
        orgId: string,
        distributorId: string, // Simplified for Firestore type parity
        initialStatus: ReleaseDeploymentDocument['status'] = 'processing',
        metadata?: { title?: string; artist?: string; coverArtUrl?: string }
    ): Promise<ReleaseDeploymentDocument> {
        const id = crypto.randomUUID();
        const deployment: Omit<ReleaseDeploymentDocument, 'createdAt' | 'updatedAt'> = {
            id,
            internalReleaseId,
            userId,
            orgId,
            distributorId,
            status: initialStatus,
            submittedAt: Timestamp.now(),
            lastCheckedAt: Timestamp.now(),
            title: metadata?.title,
            artist: metadata?.artist,
            coverArtUrl: metadata?.coverArtUrl
        };

        // use add logic via set with custom ID if we want to preserve UUID, 
        // but let's use the service's set to handle updatedAt
        await this.set(id, deployment as ReleaseDeploymentDocument);

        // Return with dummy timestamps for immediate UI use if needed, 
        // though usually we fetch from firestore
        return {
            ...deployment,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
    }

    /**
     * Updates the status and details of a deployment
     */
    async updateDeploymentStatus(
        deploymentId: string,
        status: ReleaseDeploymentDocument['status'],
        details?: {
            externalId?: string;
            errors?: unknown[];
            trackingLink?: string;
        }
    ): Promise<void> {
        const updates: Partial<ReleaseDeploymentDocument> = {
            status,
            lastCheckedAt: Timestamp.now(),
        };

        if (details?.externalId) updates.externalId = details.externalId;
        if (details?.errors) updates.errors = details.errors;
        if (details?.trackingLink) updates.trackingLink = details.trackingLink;

        await this.update(deploymentId, updates);
    }

    async getDeployment(id: string): Promise<ReleaseDeploymentDocument | null> {
        return this.get(id);
    }

    async getDeploymentsForRelease(internalReleaseId: string): Promise<ReleaseDeploymentDocument[]> {
        return this.list([this.where('internalReleaseId', '==', internalReleaseId)]);
    }

    async getAllDeployments(filter?: {
        userId?: string;
        orgId?: string;
        distributorId?: string;
        internalReleaseId?: string;
        status?: ReleaseDeploymentDocument['status'];
    }): Promise<ReleaseDeploymentDocument[]> {
        const constraints = [];

        if (filter) {
            if (filter.userId) constraints.push(this.where('userId', '==', filter.userId));
            if (filter.orgId) constraints.push(this.where('orgId', '==', filter.orgId));
            if (filter.distributorId) constraints.push(this.where('distributorId', '==', filter.distributorId));
            if (filter.internalReleaseId) constraints.push(this.where('internalReleaseId', '==', filter.internalReleaseId));
            if (filter.status) constraints.push(this.where('status', '==', filter.status));
        }

        return this.list(constraints);
    }
}

export const distributionStore = new DistributionPersistenceService();
