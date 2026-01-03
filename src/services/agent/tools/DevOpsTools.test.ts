import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/functions
vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn()
}));

// Mock @/services/firebase
vi.mock('@/services/firebase', () => ({
    functions: {}
}));

import { httpsCallable } from 'firebase/functions';
import { list_clusters, get_cluster_status, scale_deployment, list_instances, restart_service } from './DevOpsTools';

const mockHttpsCallable = httpsCallable as ReturnType<typeof vi.fn>;

describe('DevOpsTools (Real GCP via Cloud Functions)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('list_clusters calls listGKEClusters function', async () => {
        const mockClusters = [
            { name: 'prod-cluster', status: 'RUNNING', location: 'us-central1-a', currentNodeCount: 5, currentMasterVersion: '1.27.3' }
        ];
        const mockCallable = vi.fn().mockResolvedValue({ data: { clusters: mockClusters } });
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await list_clusters({ projectId: 'test-project' });
        const parsed = JSON.parse(result);

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'listGKEClusters');
        expect(mockCallable).toHaveBeenCalledWith({ projectId: 'test-project', location: '-' });
        expect(parsed).toEqual(mockClusters);
    });

    it('get_cluster_status calls getGKEClusterStatus function', async () => {
        const mockStatus = {
            name: 'prod-cluster',
            status: 'RUNNING',
            conditions: [{ type: 'Ready', status: 'True' }],
            nodePools: [{ name: 'default-pool', status: 'RUNNING', nodeCount: 3 }]
        };
        const mockCallable = vi.fn().mockResolvedValue({ data: mockStatus });
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await get_cluster_status({ cluster_id: 'prod-cluster', location: 'us-central1-a' });
        const parsed = JSON.parse(result);

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'getGKEClusterStatus');
        expect(mockCallable).toHaveBeenCalledWith({
            clusterName: 'prod-cluster',
            projectId: undefined,
            location: 'us-central1-a'
        });
        expect(parsed.status).toBe('RUNNING');
    });

    it('scale_deployment calls scaleGKENodePool function', async () => {
        const mockResult = { success: true, message: 'Scaling initiated', operation: 'op-123' };
        const mockCallable = vi.fn().mockResolvedValue({ data: mockResult });
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await scale_deployment({
            cluster_id: 'prod-cluster',
            nodePoolName: 'default-pool',
            nodeCount: 5,
            location: 'us-central1-a'
        });
        const parsed = JSON.parse(result);

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'scaleGKENodePool');
        expect(mockCallable).toHaveBeenCalledWith({
            clusterName: 'prod-cluster',
            nodePoolName: 'default-pool',
            nodeCount: 5,
            projectId: undefined,
            location: 'us-central1-a'
        });
        expect(parsed.success).toBe(true);
    });

    it('list_instances calls listGCEInstances function', async () => {
        const mockInstances = [
            { name: 'web-server-01', zone: 'us-central1-a', status: 'RUNNING', machineType: 'e2-medium' }
        ];
        const mockCallable = vi.fn().mockResolvedValue({ data: { instances: mockInstances } });
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await list_instances({ zone: 'us-central1-a' });
        const parsed = JSON.parse(result);

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'listGCEInstances');
        expect(parsed).toEqual(mockInstances);
    });

    it('restart_service calls restartGCEInstance function', async () => {
        const mockResult = { success: true, message: 'Instance reset initiated', operation: 'op-456' };
        const mockCallable = vi.fn().mockResolvedValue({ data: mockResult });
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await restart_service({
            instance_name: 'web-server-01',
            zone: 'us-central1-a'
        });
        const parsed = JSON.parse(result);

        expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'restartGCEInstance');
        expect(mockCallable).toHaveBeenCalledWith({
            instanceName: 'web-server-01',
            zone: 'us-central1-a',
            projectId: undefined
        });
        expect(parsed.success).toBe(true);
        expect(parsed).toHaveProperty('timestamp');
    });

    it('handles errors gracefully', async () => {
        const mockCallable = vi.fn().mockRejectedValue(new Error('GKE API not enabled'));
        mockHttpsCallable.mockReturnValue(mockCallable);

        const result = await list_clusters();
        const parsed = JSON.parse(result);

        expect(parsed).toHaveProperty('error', 'GKE API not enabled');
        expect(parsed).toHaveProperty('hint');
    });
});
