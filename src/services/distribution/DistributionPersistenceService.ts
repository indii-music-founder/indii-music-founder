import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import type { ReleaseDeployment, DistributionStoreSchema, DeploymentFilter } from './types/persistence';
import type { DistributorId, ReleaseStatus, ValidationError } from './types/distributor';

export class DistributionPersistenceService {
    private store: Store<DistributionStoreSchema>;

    constructor(config?: { cwd?: string }) {
        let storeCwd = config?.cwd;

        // Fallback for CLI/Testing environment where Electron app is not available
        if (!storeCwd && !process.versions.electron) {
            storeCwd = process.cwd();
        }

        this.store = new Store<DistributionStoreSchema>({
            name: 'distribution-store',
            cwd: storeCwd,
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
        initialStatus: ReleaseStatus = 'processing'
    ): ReleaseDeployment {
        const now = new Date().toISOString();
        const deployment: ReleaseDeployment = {
            id: uuidv4(),
            internalReleaseId,
            distributorId,
            status: initialStatus,
            submittedAt: now,
            lastCheckedAt: now,
            lastUpdatedAt: now
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
