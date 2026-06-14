import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevOpsAgent } from './DevOpsAgent';

describe('DevOpsAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have the correct ID and metadata', () => {
        expect(DevOpsAgent.id).toBe('devops');
        expect(DevOpsAgent.name).toBe('DevOps Director');
        expect(DevOpsAgent.category).toBe('department');
    });

    it('should expose the correct authorized tools', () => {
        expect(DevOpsAgent.authorizedTools).toContain('list_clusters');
        expect(DevOpsAgent.authorizedTools).toContain('get_cluster_status');
        expect(DevOpsAgent.authorizedTools).toContain('scale_deployment');
        expect(DevOpsAgent.authorizedTools).toContain('list_instances');
        expect(DevOpsAgent.authorizedTools).toContain('restart_service');
        expect(DevOpsAgent.authorizedTools).toContain('browser_tool');
        expect(DevOpsAgent.authorizedTools).toContain('credential_vault');
    });

    it('should map the functions to correct tool declarations', () => {
        expect(DevOpsAgent.functions!.list_clusters).toBeDefined();
        expect(DevOpsAgent.functions!.get_cluster_status).toBeDefined();
        expect(DevOpsAgent.functions!.scale_deployment).toBeDefined();
        expect(DevOpsAgent.functions!.list_instances).toBeDefined();
        expect(DevOpsAgent.functions!.restart_service).toBeDefined();
    });

    it('should return error for functions since cloud provider is not connected in tests', async () => {
        const listClustersRes = await DevOpsAgent.functions!.list_clusters();
        expect(listClustersRes.success).toBe(false);
        expect(listClustersRes.error).toContain('requires a connected cloud provider');

        const statusRes = await DevOpsAgent.functions!.get_cluster_status({ cluster_id: 'test' });
        expect(statusRes.success).toBe(false);
        expect(statusRes.error).toContain('requires a connected cloud provider');

        const scaleRes = await DevOpsAgent.functions!.scale_deployment({ deployment: 'test', replicas: 3 });
        expect(scaleRes.success).toBe(false);
        expect(scaleRes.error).toContain('requires a connected cloud provider');

        const listInstancesRes = await DevOpsAgent.functions!.list_instances();
        expect(listInstancesRes.success).toBe(false);
        expect(listInstancesRes.error).toContain('requires a connected cloud provider');

        const restartRes = await DevOpsAgent.functions!.restart_service({ service_name: 'test' });
        expect(restartRes.success).toBe(false);
        expect(restartRes.error).toContain('requires a connected cloud provider');
    });
});
