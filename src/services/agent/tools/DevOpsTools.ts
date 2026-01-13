import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';
import { useStore } from '@/core/store';

// Tool: DevOps Infrastructure (Real GKE/GCE via Cloud Functions)
// This tool interacts with Google Cloud Platform services through Firebase Cloud Functions.
// Backend services use @google-cloud/container (GKE) and googleapis (GCE).

interface GKECluster {
    name: string;
    status: string;
    location: string;
    currentNodeCount: number;
    currentMasterVersion: string;
    createTime: string;
}

interface GKEClusterStatus {
    name: string;
    status: string;
    conditions: Array<{ type: string; status: string; message?: string }>;
    nodePools: Array<{
        name: string;
        status: string;
        nodeCount: number;
        autoscaling?: { enabled: boolean; minNodeCount: number; maxNodeCount: number };
    }>;
}

interface GCEInstance {
    name: string;
    zone: string;
    status: string;
    machineType: string;
    internalIP?: string;
    externalIP?: string;
}

interface ScaleResult {
    success: boolean;
    message: string;
    operation?: string;
}

interface RestartResult {
    success: boolean;
    message: string;
    operation?: string;
}

/**
 * Helper to request human approval for sensitive DevOps actions.
 * Prevents Agent hallucination or injection from triggering destructive infra changes.
 */
async function requireApproval(action: string, details: string): Promise<boolean> {
    const { requestApproval } = useStore.getState();
    const approved = await requestApproval(
        `[DevOps Security] Agent is requesting to execute: **${action}**\n\nDetails: ${details}`,
        'critical'
    );
    return approved;
}

export const DevOpsTools: Record<string, AnyToolFunction> = {
    list_clusters: wrapTool('list_clusters', async (args?: { projectId?: string; location?: string }) => {
        console.info(`[DevOps] Listing GKE clusters`);

        const listGKEClustersFn = httpsCallable<
            { projectId?: string; location?: string },
            { clusters: GKECluster[] }
        >(functions, 'listGKEClusters');

        const result = await listGKEClustersFn({
            projectId: args?.projectId,
            location: args?.location || '-' // '-' means all locations
        });

        return toolSuccess({
            clusters: result.data.clusters
        }, `Retrieved ${result.data.clusters.length} GKE clusters.`);
    }),

    get_cluster_status: wrapTool('get_cluster_status', async (args: { cluster_id: string; projectId?: string; location?: string }) => {
        console.info(`[DevOps] Getting status for cluster: ${args.cluster_id}`);

        const getGKEClusterStatusFn = httpsCallable<
            { clusterName: string; projectId?: string; location?: string },
            GKEClusterStatus
        >(functions, 'getGKEClusterStatus');

        const result = await getGKEClusterStatusFn({
            clusterName: args.cluster_id,
            projectId: args.projectId,
            location: args.location
        });

        return toolSuccess(result.data, `Retrieved status for cluster ${args.cluster_id}.`);
    }),

    scale_deployment: wrapTool('scale_deployment', async (args: {
        cluster_id: string;
        nodePoolName: string;
        nodeCount: number;
        projectId?: string;
        location?: string
    }) => {
        // SECURITY: Require approval for scaling operations
        const isApproved = await requireApproval(
            `Scale Node Pool`,
            `Cluster: ${args.cluster_id}\nNode Pool: ${args.nodePoolName}\nNew Node Count: ${args.nodeCount}`
        );

        if (!isApproved) {
            return toolError("User denied the scaling request.", "APPROVAL_DENIED");
        }

        console.info(`[DevOps] Scaling node pool ${args.nodePoolName} in ${args.cluster_id} to ${args.nodeCount} nodes`);

        const scaleGKENodePoolFn = httpsCallable<
            { clusterName: string; nodePoolName: string; nodeCount: number; projectId?: string; location?: string },
            ScaleResult
        >(functions, 'scaleGKENodePool');

        const result = await scaleGKENodePoolFn({
            clusterName: args.cluster_id,
            nodePoolName: args.nodePoolName,
            nodeCount: args.nodeCount,
            projectId: args.projectId,
            location: args.location
        });

        return toolSuccess(result.data, result.data.success ? `Successfully scaled ${args.nodePoolName}.` : `Failed to scale ${args.nodePoolName}.`);
    }),

    list_instances: wrapTool('list_instances', async (args?: { projectId?: string; zone?: string }) => {
        console.info(`[DevOps] Listing GCE instances`);

        const listGCEInstancesFn = httpsCallable<
            { projectId?: string; zone?: string },
            { instances: GCEInstance[] }
        >(functions, 'listGCEInstances');

        const result = await listGCEInstancesFn({
            projectId: args?.projectId,
            zone: args?.zone
        });

        return toolSuccess({
            instances: result.data.instances
        }, `Retrieved ${result.data.instances.length} GCE instances.`);
    }),

    restart_service: wrapTool('restart_service', async (args: {
        instance_name: string;
        zone: string;
        projectId?: string
    }) => {
        // SECURITY: Require approval for restart operations
        const isApproved = await requireApproval(
            `Restart Instance`,
            `Instance: ${args.instance_name}\nZone: ${args.zone}`
        );

        if (!isApproved) {
            return toolError("User denied the restart request.", "APPROVAL_DENIED");
        }

        console.info(`[DevOps] Restarting instance: ${args.instance_name} in ${args.zone}`);

        const restartGCEInstanceFn = httpsCallable<
            { instanceName: string; zone: string; projectId?: string },
            RestartResult
        >(functions, 'restartGCEInstance');

        const result = await restartGCEInstanceFn({
            instanceName: args.instance_name,
            zone: args.zone,
            projectId: args.projectId
        });

        return toolSuccess({
            ...result.data,
            timestamp: new Date().toISOString()
        }, result.data.success ? `Successfully restarted ${args.instance_name}.` : `Failed to restart ${args.instance_name}.`);
    })
};
