import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';

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

export const list_clusters = async (args?: { projectId?: string; location?: string }) => {
    console.log(`[DevOps] Listing GKE clusters`);

    try {
        const listGKEClustersFn = httpsCallable<
            { projectId?: string; location?: string },
            { clusters: GKECluster[] }
        >(functions, 'listGKEClusters');

        const result = await listGKEClustersFn({
            projectId: args?.projectId,
            location: args?.location || '-' // '-' means all locations
        });

        return JSON.stringify(result.data.clusters);
    } catch (error) {
        const err = error as Error;
        console.error('[DevOps] Failed to list clusters:', err.message);
        return JSON.stringify({ error: err.message, hint: 'Ensure GKE API is enabled and service account has permissions.' });
    }
};

export const get_cluster_status = async (args: { cluster_id: string; projectId?: string; location?: string }) => {
    console.log(`[DevOps] Getting status for cluster: ${args.cluster_id}`);

    try {
        const getGKEClusterStatusFn = httpsCallable<
            { clusterName: string; projectId?: string; location?: string },
            GKEClusterStatus
        >(functions, 'getGKEClusterStatus');

        const result = await getGKEClusterStatusFn({
            clusterName: args.cluster_id,
            projectId: args.projectId,
            location: args.location
        });

        return JSON.stringify(result.data);
    } catch (error) {
        const err = error as Error;
        console.error('[DevOps] Failed to get cluster status:', err.message);
        return JSON.stringify({ error: err.message, status: 'UNKNOWN' });
    }
};

export const scale_deployment = async (args: {
    cluster_id: string;
    nodePoolName: string;
    nodeCount: number;
    projectId?: string;
    location?: string
}) => {
    console.log(`[DevOps] Scaling node pool ${args.nodePoolName} in ${args.cluster_id} to ${args.nodeCount} nodes`);

    try {
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

        return JSON.stringify(result.data);
    } catch (error) {
        const err = error as Error;
        console.error('[DevOps] Failed to scale deployment:', err.message);
        return JSON.stringify({ success: false, error: err.message });
    }
};

export const list_instances = async (args?: { projectId?: string; zone?: string }) => {
    console.log(`[DevOps] Listing GCE instances`);

    try {
        const listGCEInstancesFn = httpsCallable<
            { projectId?: string; zone?: string },
            { instances: GCEInstance[] }
        >(functions, 'listGCEInstances');

        const result = await listGCEInstancesFn({
            projectId: args?.projectId,
            zone: args?.zone
        });

        return JSON.stringify(result.data.instances);
    } catch (error) {
        const err = error as Error;
        console.error('[DevOps] Failed to list instances:', err.message);
        return JSON.stringify({ error: err.message, hint: 'Ensure Compute Engine API is enabled.' });
    }
};

export const restart_service = async (args: {
    instance_name: string;
    zone: string;
    projectId?: string
}) => {
    console.log(`[DevOps] Restarting instance: ${args.instance_name} in ${args.zone}`);

    try {
        const restartGCEInstanceFn = httpsCallable<
            { instanceName: string; zone: string; projectId?: string },
            RestartResult
        >(functions, 'restartGCEInstance');

        const result = await restartGCEInstanceFn({
            instanceName: args.instance_name,
            zone: args.zone,
            projectId: args.projectId
        });

        return JSON.stringify({
            ...result.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        const err = error as Error;
        console.error('[DevOps] Failed to restart instance:', err.message);
        return JSON.stringify({ success: false, error: err.message });
    }
};

export const DevOpsTools = {
    list_clusters,
    get_cluster_status,
    scale_deployment,
    list_instances,
    restart_service
};
