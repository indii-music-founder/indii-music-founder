/**
 * GCE Service - Google Compute Engine Instance Management
 *
 * This module provides real GCE instance management through the Google Compute API.
 * Requires service account with roles/compute.viewer or roles/compute.admin.
 *
 * Setup:
 * 1. Enable Compute API: gcloud services enable compute.googleapis.com
 * 2. Grant role: gcloud projects add-iam-policy-binding PROJECT_ID \
 *      --member="serviceAccount:FIREBASE_SERVICE_ACCOUNT" \
 *      --role="roles/compute.viewer"
 */

import { compute_v1, google } from 'googleapis';
import { logger } from 'firebase-functions';

// Initialize Compute client with ADC
const getComputeClient = async (): Promise<compute_v1.Compute> => {
    const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/compute.readonly'],
    });
    return google.compute({ version: 'v1', auth });
};

// For write operations
const getComputeClientReadWrite = async (): Promise<compute_v1.Compute> => {
    const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/compute'],
    });
    return google.compute({ version: 'v1', auth });
};

export interface InstanceInfo {
    name: string;
    zone: string;
    status: string;
    internalIp?: string;
    externalIp?: string;
    machineType: string;
}

/**
 * List all GCE instances in the project (all zones)
 */
export async function listInstances(projectId: string): Promise<InstanceInfo[]> {
    try {
        const compute = await getComputeClient();
        const response = await compute.instances.aggregatedList({
            project: projectId,
        });

        const instances: InstanceInfo[] = [];
        const items = response.data.items || {};

        for (const [zone, zoneData] of Object.entries(items)) {
            const zoneInstances = (zoneData as compute_v1.Schema$InstancesScopedList).instances || [];
            for (const instance of zoneInstances) {
                // Extract zone name from full path
                const zoneName = zone.replace('zones/', '');

                // Get internal IP
                const networkInterface = instance.networkInterfaces?.[0];
                const internalIp = networkInterface?.networkIP;
                const externalIp = networkInterface?.accessConfigs?.[0]?.natIP;

                // Get machine type (extract just the type name)
                const machineTypeParts = instance.machineType?.split('/') || [];
                const machineType = machineTypeParts[machineTypeParts.length - 1] || 'unknown';

                instances.push({
                    name: instance.name || 'unknown',
                    zone: zoneName,
                    status: instance.status || 'UNKNOWN',
                    internalIp,
                    externalIp,
                    machineType,
                });
            }
        }

        return instances;
    } catch (error) {
        logger.error('[GCE] listInstances failed:', error);
        throw new Error(`Failed to list GCE instances: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get status of a specific instance
 */
export async function getInstanceStatus(
    projectId: string,
    zone: string,
    instanceName: string
): Promise<{ status: string; uptime?: string; health: string }> {
    try {
        const compute = await getComputeClient();
        const response = await compute.instances.get({
            project: projectId,
            zone,
            instance: instanceName,
        });

        const instance = response.data;

        // Calculate approximate uptime if running
        let uptime: string | undefined;
        if (instance.status === 'RUNNING' && instance.lastStartTimestamp) {
            const startTime = new Date(instance.lastStartTimestamp);
            const now = new Date();
            const diffMs = now.getTime() - startTime.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            uptime = `${diffDays}d ${diffHours}h`;
        }

        return {
            status: instance.status || 'UNKNOWN',
            uptime,
            health: instance.status === 'RUNNING' ? 'HEALTHY' : 'UNKNOWN',
        };
    } catch (error) {
        logger.error('[GCE] getInstanceStatus failed:', error);
        throw new Error(`Failed to get instance status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Start a stopped instance
 */
export async function startInstance(
    projectId: string,
    zone: string,
    instanceName: string
): Promise<{ success: boolean; message: string }> {
    try {
        const compute = await getComputeClientReadWrite();
        await compute.instances.start({
            project: projectId,
            zone,
            instance: instanceName,
        });

        return {
            success: true,
            message: `Instance '${instanceName}' is starting.`,
        };
    } catch (error) {
        logger.error('[GCE] startInstance failed:', error);
        throw new Error(`Failed to start instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Stop a running instance
 */
export async function stopInstance(
    projectId: string,
    zone: string,
    instanceName: string
): Promise<{ success: boolean; message: string }> {
    try {
        const compute = await getComputeClientReadWrite();
        await compute.instances.stop({
            project: projectId,
            zone,
            instance: instanceName,
        });

        return {
            success: true,
            message: `Instance '${instanceName}' is stopping.`,
        };
    } catch (error) {
        logger.error('[GCE] stopInstance failed:', error);
        throw new Error(`Failed to stop instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Reset (restart) an instance
 */
export async function resetInstance(
    projectId: string,
    zone: string,
    instanceName: string
): Promise<{ success: boolean; message: string }> {
    try {
        const compute = await getComputeClientReadWrite();
        await compute.instances.reset({
            project: projectId,
            zone,
            instance: instanceName,
        });

        return {
            success: true,
            message: `Instance '${instanceName}' is restarting.`,
        };
    } catch (error) {
        logger.error('[GCE] resetInstance failed:', error);
        throw new Error(`Failed to reset instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
