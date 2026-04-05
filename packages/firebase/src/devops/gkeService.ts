/**
 * GKE Service - Google Kubernetes Engine Management
 *
 * This module provides real GKE cluster management through the Google Cloud Container API.
 * Requires service account with roles/container.admin or roles/container.viewer.
 *
 * Setup:
 * 1. Enable Container API: gcloud services enable container.googleapis.com
 * 2. Grant role: gcloud projects add-iam-policy-binding PROJECT_ID \
 *      --member="serviceAccount:FIREBASE_SERVICE_ACCOUNT" \
 *      --role="roles/container.viewer"
 */

import { container_v1, google } from 'googleapis';
import { logger } from 'firebase-functions';

// Initialize GKE client with ADC (Application Default Credentials)
const getGKEClient = async (): Promise<container_v1.Container> => {
    const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    return google.container({ version: 'v1', auth });
};

export interface ClusterInfo {
    name: string;
    status: string;
    location: string;
    nodes: number;
    version: string;
    endpoint?: string;
}

export interface ClusterStatus {
    status: string;
    uptime?: string;
    alerts: string[];
    nodeCount: number;
    conditions?: { type: string; status: string; message?: string }[];
}

/**
 * List all GKE clusters in the project
 */
export async function listClusters(projectId: string): Promise<ClusterInfo[]> {
    try {
        const gke = await getGKEClient();
        const response = await gke.projects.locations.clusters.list({
            parent: `projects/${projectId}/locations/-`, // '-' means all locations
        });

        const clusters = response.data.clusters || [];

        return clusters.map((cluster) => ({
            name: cluster.name || 'unknown',
            status: cluster.status || 'UNKNOWN',
            location: cluster.location || 'unknown',
            nodes: cluster.currentNodeCount || 0,
            version: cluster.currentMasterVersion || 'unknown',
            endpoint: cluster.endpoint ?? undefined,
        }));
    } catch (error) {
        logger.error('[GKE] listClusters failed:', error);
        throw new Error(`Failed to list GKE clusters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get detailed status of a specific cluster
 */
export async function getClusterStatus(
    projectId: string,
    location: string,
    clusterName: string
): Promise<ClusterStatus> {
    try {
        const gke = await getGKEClient();
        const response = await gke.projects.locations.clusters.get({
            name: `projects/${projectId}/locations/${location}/clusters/${clusterName}`,
        });

        const cluster = response.data;
        const alerts: string[] = [];

        // Check cluster conditions for issues
        // Note: StatusCondition uses 'code' and 'message', not 'status' and 'type'
        if (cluster.conditions) {
            for (const condition of cluster.conditions) {
                const conditionCode = (condition as { code?: string }).code;
                const conditionMessage = condition.message;
                if (conditionCode && conditionCode !== 'GKE_NODE_POOL_OK') {
                    alerts.push(`${conditionCode}: ${conditionMessage || 'Issue detected'}`);
                }
            }
        }

        // Determine overall status
        let status = 'HEALTHY';
        if (cluster.status === 'ERROR' || cluster.status === 'DEGRADED') {
            status = 'ERROR';
        } else if (cluster.status === 'RECONCILING' || cluster.status === 'PROVISIONING') {
            status = 'UPDATING';
        } else if (alerts.length > 0) {
            status = 'WARNING';
        }

        return {
            status,
            alerts,
            nodeCount: cluster.currentNodeCount || 0,
            conditions: cluster.conditions?.map((c) => ({
                type: (c as { code?: string }).code || '',
                status: c.canonicalCode || 'UNKNOWN',
                message: c.message ?? undefined,
            })),
        };
    } catch (error) {
        logger.error('[GKE] getClusterStatus failed:', error);
        throw new Error(`Failed to get cluster status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Scale a node pool in a cluster
 */
export async function scaleNodePool(
    projectId: string,
    location: string,
    clusterName: string,
    nodePoolName: string,
    nodeCount: number
): Promise<{ success: boolean; message: string }> {
    try {
        const gke = await getGKEClient();
        await gke.projects.locations.clusters.nodePools.setSize({
            name: `projects/${projectId}/locations/${location}/clusters/${clusterName}/nodePools/${nodePoolName}`,
            requestBody: {
                nodeCount,
            },
        });

        return {
            success: true,
            message: `Node pool '${nodePoolName}' in cluster '${clusterName}' is being scaled to ${nodeCount} nodes.`,
        };
    } catch (error) {
        logger.error('[GKE] scaleNodePool failed:', error);
        throw new Error(`Failed to scale node pool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
