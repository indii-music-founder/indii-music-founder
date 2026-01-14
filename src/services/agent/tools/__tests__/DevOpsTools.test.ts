import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevOpsTools } from '../DevOpsTools';

// Mock Firebase Functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: (_functions: any, _name: string) => mockHttpsCallable
}));

vi.mock('@/services/firebase', () => ({
    functions: {}
}));

// Mock useStore for requestApproval
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            requestApproval: vi.fn().mockResolvedValue(true)
        })
    }
}));

// Mock console methods
const consoleMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
};
global.console = { ...global.console, ...consoleMock };

describe('DevOpsTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('list_clusters', () => {
        it('should call listGKEClusters cloud function and return clusters', async () => {
            const mockClusters = [
                { name: 'cluster-1', status: 'RUNNING', location: 'us-central1' },
                { name: 'cluster-2', status: 'STOPPING', location: 'europe-west1' }
            ];

            mockHttpsCallable.mockResolvedValueOnce({
                data: { clusters: mockClusters }
            });

            const result = await DevOpsTools.list_clusters({});

            expect(result.success).toBe(true);
            expect(result.data.clusters).toEqual(mockClusters);
            expect(result.message).toContain('Retrieved 2 GKE clusters');
        });

        it('should handle errors gracefully', async () => {
            mockHttpsCallable.mockRejectedValueOnce(new Error('Cloud API Error'));

            const result = await DevOpsTools.list_clusters({});

            expect(result.success).toBe(false);
            expect(result.error).toBe('Cloud API Error');
            expect(result.metadata?.errorCode).toBe('TOOL_EXECUTION_ERROR');
        });
    });

    describe('scale_deployment', () => {
        it('should call scaleGKENodePool cloud function', async () => {
            mockHttpsCallable.mockResolvedValueOnce({
                data: { success: true, message: 'Scaled successfully' }
            });

            const args = {
                cluster_id: 'test-cluster',
                nodePoolName: 'default-pool',
                nodeCount: 5
            };
            const result = await DevOpsTools.scale_deployment(args);

            expect(result.success).toBe(true);
            expect(result.data.success).toBe(true);
            expect(result.message).toContain('Successfully scaled default-pool');
        });
    });

    describe('restart_service', () => {
        it('should call restartGCEInstance cloud function', async () => {
            mockHttpsCallable.mockResolvedValueOnce({
                data: { success: true, message: 'Restarted successfully' }
            });

            const args = {
                instance_name: 'test-instance',
                zone: 'us-central1-a'
            };
            const result = await DevOpsTools.restart_service(args);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Successfully restarted test-instance');
        });
    });
});
