import { v4 as uuidv4 } from 'uuid';
import type { ReleaseDeployment, DistributionStoreSchema, DeploymentFilter } from './types/persistence';
import type { DistributorId, ReleaseStatus, ValidationError } from './types/distributor';

// Simple in-memory/localStorage mock for browser compatibility
class SimpleStore<T> {
    private data: T;
    private key: string;

    constructor(options: { name: string; defaults: T }) {
        this.key = options.name;
        this.data = options.defaults;

        if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem(this.key);
            if (saved) {
                try {
                    this.data = JSON.parse(saved);
                } catch (e) {
                    console.warn('Failed to parse saved store', e);
                }
            }
        }
    }

    get<K extends keyof T>(key: K): T[K] {
        return this.data[key];
    }

    set<K extends keyof T>(key: K, value: T[K]): void {
        this.data[key] = value;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(this.key, JSON.stringify(this.data));
        }
    }

    clear(): void {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(this.key);
        }
    }
}

export class DistributionPersistenceService {
    private store: SimpleStore<DistributionStoreSchema>;

    constructor(_config?: { cwd?: string }) {
        this.store = new SimpleStore<DistributionStoreSchema>({
            name: 'distribution-store',
            defaults: {
                deployments: {},
                byInternalId: {}
            }
        });
    }

    /**
     * Records a new deployment or updates an existing one if ID provided
     */
    saveDeployment(deployment: ReleaseDeployment): void {
        const deployments = this.store.get('deployments');
        const byInternalId = this.store.get('byInternalId');

        // Update main record
        deployments[deployment.id] = deployment;

        // Update index
        const internalIdIdx = byInternalId[deployment.internalReleaseId] || [];
        if (!internalIdIdx.includes(deployment.id)) {
            internalIdIdx.push(deployment.id);
            byInternalId[deployment.internalReleaseId] = internalIdIdx;
        }

        this.store.set('deployments', deployments);
        this.store.set('byInternalId', byInternalId);
    }

    /**
     * Creates a new deployment record from a submission
     */
    createDeployment(
        internalReleaseId: string,
        distributorId: DistributorId,
        initialStatus: ReleaseStatus = 'processing',
        metadata?: { title?: string; artist?: string; coverArtUrl?: string }
    ): ReleaseDeployment {
        const now = new Date().toISOString();
        const deployment: ReleaseDeployment = {
            id: uuidv4(),
            internalReleaseId,
            distributorId,
            status: initialStatus,
            submittedAt: now,
            lastCheckedAt: now,
            lastUpdatedAt: now,
            title: metadata?.title,
            artist: metadata?.artist,
            coverArtUrl: metadata?.coverArtUrl
        };

        this.saveDeployment(deployment);
        return deployment;
    }

    /**
     * Updates the status and details of a deployment
     */
    updateDeploymentStatus(
        deploymentId: string,
        status: ReleaseStatus,
        details?: {
            externalId?: string;
            errors?: ValidationError[];
            trackingLink?: string;
        }
    ): ReleaseDeployment | null {
        const deployment = this.getDeployment(deploymentId);
        if (!deployment) return null;

        deployment.status = status;
        deployment.lastUpdatedAt = new Date().toISOString();
        deployment.lastCheckedAt = new Date().toISOString(); // Implies we just checked it

        if (details?.externalId) deployment.externalId = details.externalId;
        if (details?.errors) deployment.errors = details.errors;
        if (details?.trackingLink) deployment.trackingLink = details.trackingLink;

        this.saveDeployment(deployment);
        return deployment;
    }

    getDeployment(id: string): ReleaseDeployment | undefined {
        return this.store.get('deployments')[id];
    }

    getDeploymentsForRelease(internalReleaseId: string): ReleaseDeployment[] {
        const index = this.store.get('byInternalId')[internalReleaseId] || [];
        return index.map(id => this.store.get('deployments')[id]).filter(Boolean);
    }

    getAllDeployments(filter?: DeploymentFilter): ReleaseDeployment[] {
        const all = Object.values(this.store.get('deployments'));
        if (!filter) return all;

        return all.filter(d => {
            if (filter.distributorId && d.distributorId !== filter.distributorId) return false;
            if (filter.internalReleaseId && d.internalReleaseId !== filter.internalReleaseId) return false;
            if (filter.status && d.status !== filter.status) return false;
            return true;
        });
    }

    clearAll(): void {
        this.store.clear();
    }
}

export const distributionStore = new DistributionPersistenceService();
