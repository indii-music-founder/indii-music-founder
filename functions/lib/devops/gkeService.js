"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.listClusters = listClusters;
exports.getClusterStatus = getClusterStatus;
exports.scaleNodePool = scaleNodePool;
const googleapis_1 = require("googleapis");
const firebase_functions_1 = require("firebase-functions");
// Initialize GKE client with ADC (Application Default Credentials)
const getGKEClient = async () => {
    const auth = new googleapis_1.google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    return googleapis_1.google.container({ version: 'v1', auth });
};
/**
 * List all GKE clusters in the project
 */
async function listClusters(projectId) {
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
            endpoint: cluster.endpoint,
        }));
    }
    catch (error) {
        firebase_functions_1.logger.error('[GKE] listClusters failed:', error);
        throw new Error(`Failed to list GKE clusters: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Get detailed status of a specific cluster
 */
async function getClusterStatus(projectId, location, clusterName) {
    var _a;
    try {
        const gke = await getGKEClient();
        const response = await gke.projects.locations.clusters.get({
            name: `projects/${projectId}/locations/${location}/clusters/${clusterName}`,
        });
        const cluster = response.data;
        const alerts = [];
        // Check cluster conditions for issues
        if (cluster.conditions) {
            for (const condition of cluster.conditions) {
                if (condition.status === 'True' && condition.type !== 'Available') {
                    alerts.push(`${condition.type}: ${condition.message || 'Issue detected'}`);
                }
            }
        }
        // Determine overall status
        let status = 'HEALTHY';
        if (cluster.status === 'ERROR' || cluster.status === 'DEGRADED') {
            status = 'ERROR';
        }
        else if (cluster.status === 'RECONCILING' || cluster.status === 'PROVISIONING') {
            status = 'UPDATING';
        }
        else if (alerts.length > 0) {
            status = 'WARNING';
        }
        return {
            status,
            alerts,
            nodeCount: cluster.currentNodeCount || 0,
            conditions: (_a = cluster.conditions) === null || _a === void 0 ? void 0 : _a.map((c) => ({
                type: c.type || '',
                status: c.status || '',
                message: c.message,
            })),
        };
    }
    catch (error) {
        firebase_functions_1.logger.error('[GKE] getClusterStatus failed:', error);
        throw new Error(`Failed to get cluster status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Scale a node pool in a cluster
 */
async function scaleNodePool(projectId, location, clusterName, nodePoolName, nodeCount) {
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
    }
    catch (error) {
        firebase_functions_1.logger.error('[GKE] scaleNodePool failed:', error);
        throw new Error(`Failed to scale node pool: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
//# sourceMappingURL=gkeService.js.map