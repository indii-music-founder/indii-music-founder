import { v4 as uuidv4 } from 'uuid';
import { db } from '@/services/firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import type { ReleaseDeployment, DeploymentFilter } from './types/persistence';
import type { DistributorId, ReleaseStatus, ValidationError } from './types/distributor';

export class DistributionPersistenceService {
    private readonly COLLECTION = 'deployments';

    constructor() { }

    /**
     * Records a new deployment or updates an existing one
     */
    async saveDeployment(deployment: ReleaseDeployment): Promise<void> {
        try {
            await setDoc(doc(db, this.COLLECTION, deployment.id), deployment);
        } catch (error) {
            console.error('[DistributionPersistence] Failed to save deployment:', error);
            throw error;
        }
    }

    /**
     * Creates a new deployment record from a submission
     */
    async createDeployment(
        internalReleaseId: string,
        userId: string,
        orgId: string,
        distributorId: DistributorId,
        initialStatus: ReleaseStatus = 'processing',
        metadata?: { title?: string; artist?: string; coverArtUrl?: string }
    ): Promise<ReleaseDeployment> {
        const now = new Date().toISOString();
        const deployment: ReleaseDeployment = {
            id: uuidv4(),
            internalReleaseId,
            userId,
            orgId,
            distributorId,
            status: initialStatus,
            submittedAt: now,
            lastCheckedAt: now,
            lastUpdatedAt: now,
            title: metadata?.title,
            artist: metadata?.artist,
            coverArtUrl: metadata?.coverArtUrl
        };

        await this.saveDeployment(deployment);
        return deployment;
    }

    /**
     * Updates the status and details of a deployment
     */
    async updateDeploymentStatus(
        deploymentId: string,
        status: ReleaseStatus,
        details?: {
            externalId?: string;
            errors?: ValidationError[];
            trackingLink?: string;
        }
    ): Promise<ReleaseDeployment | null> {
        try {
            const deployment = await this.getDeployment(deploymentId);
            if (!deployment) return null;

            deployment.status = status;
            deployment.lastUpdatedAt = new Date().toISOString();
            deployment.lastCheckedAt = new Date().toISOString();

            if (details?.externalId) deployment.externalId = details.externalId;
            if (details?.errors) deployment.errors = details.errors;
            if (details?.trackingLink) deployment.trackingLink = details.trackingLink;

            await this.saveDeployment(deployment);
            return deployment;
        } catch (error) {
            console.error('[DistributionPersistence] Failed to update status:', error);
            return null;
        }
    }

    async getDeployment(id: string): Promise<ReleaseDeployment | undefined> {
        try {
            const docSnap = await getDoc(doc(db, this.COLLECTION, id));
            if (docSnap.exists()) {
                return docSnap.data() as ReleaseDeployment;
            }
            return undefined;
        } catch (error) {
            console.error('[DistributionPersistence] Failed to get deployment:', error);
            return undefined;
        }
    }

    async getDeploymentsForRelease(internalReleaseId: string): Promise<ReleaseDeployment[]> {
        try {
            const q = query(
                collection(db, this.COLLECTION),
                where('internalReleaseId', '==', internalReleaseId)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data() as ReleaseDeployment);
        } catch (error) {
            console.error('[DistributionPersistence] Failed to get deployments for release:', error);
            return [];
        }
    }

    async getAllDeployments(filter?: DeploymentFilter): Promise<ReleaseDeployment[]> {
        try {
            const constraints: import('firebase/firestore').QueryConstraint[] = [];

            if (filter) {
                if (filter.userId) constraints.push(where('userId', '==', filter.userId));
                if (filter.orgId) constraints.push(where('orgId', '==', filter.orgId));
                if (filter.distributorId) constraints.push(where('distributorId', '==', filter.distributorId));
                if (filter.internalReleaseId) constraints.push(where('internalReleaseId', '==', filter.internalReleaseId));
                if (filter.status) constraints.push(where('status', '==', filter.status));
            }

            const q = query(collection(db, this.COLLECTION), ...constraints);
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data() as ReleaseDeployment);
        } catch (error) {
            console.error('[DistributionPersistence] Failed to get all deployments:', error);
            return [];
        }
    }
}

export const distributionStore = new DistributionPersistenceService();
