import { v4 as uuidv4 } from 'uuid';
import type { ReleaseDeployment, DistributionStoreSchema, DeploymentFilter } from './types/persistence';
import type { DistributorId, ReleaseStatus, ValidationError } from './types/distributor';

/**
 * Simple Storage Adapter to replace electron-store for Web Compatibility
 */
class SimpleStore<T extends object> {
    private data: T;
    private name: string;
    private isBrowser: boolean;

    constructor(options: { name: string; defaults: T; cwd?: string }) {
        this.name = options.name;
        this.data = options.defaults;
        this.isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

        this.load();
    }

    private load(): void {
        if (this.isBrowser) {
            try {
                const item = window.localStorage.getItem(this.name);
                if (item) {
                    this.data = { ...this.data, ...JSON.parse(item) };
                }
            } catch (e) {
                console.warn('Failed to load from localStorage', e);
            }
        }
    }

    private save(): void {
        if (this.isBrowser) {
            try {
                window.localStorage.setItem(this.name, JSON.stringify(this.data));
            } catch (e) {
                console.warn('Failed to save to localStorage', e);
            }
        }
    }

    get<K extends keyof T>(key: K): T[K] {
        return this.data[key];
    }

    set<K extends keyof T>(key: K, value: T[K]): void {
        this.data[key] = value;
        this.save();
    }

    clear(): void {
        this.data = {} as T;
        if (this.isBrowser) {
            window.localStorage.removeItem(this.name);
        }
    }
}

export class DistributionPersistenceService {
    private store: SimpleStore<DistributionStoreSchema>;

    constructor(config?: { cwd?: string }) {
        this.store = new SimpleStore<DistributionStoreSchema>({
            name: 'distribution-store',
            defaults: {
                deployments: {},
                byInternalId: {}
            },
            cwd: config?.cwd
        });
    }

    /**
     * Records a new deployment or updates an existing one if ID provided
     */
    saveDeployment(deployment: ReleaseDeployment): void {
        const deployments = this.store.get('deployments') || {};
        const byInternalId = this.store.get('byInternalId') || {};

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
        const deployments = this.store.get('deployments');
        return deployments ? deployments[id] : undefined;
    }

    getDeploymentsForRelease(internalReleaseId: string): ReleaseDeployment[] {
        const byInternalId = this.store.get('byInternalId');
        const deployments = this.store.get('deployments');

        if (!byInternalId || !deployments) return [];

        const index = byInternalId[internalReleaseId] || [];
        return index.map(id => deployments[id]).filter(Boolean);
    }

    getAllDeployments(filter?: DeploymentFilter): ReleaseDeployment[] {
        const deployments = this.store.get('deployments');
        if (!deployments) return [];

        const all = Object.values(deployments);
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
