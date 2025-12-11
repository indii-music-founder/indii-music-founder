import { describe, it, expect } from 'vitest';
import { list_clusters, get_cluster_status, scale_deployment, list_instances, restart_service } from './DevOpsTools';

describe('DevOpsTools (Mock)', () => {

    it('list_clusters returns mocked clusters', async () => {
        const result = await list_clusters();
        const parsed = JSON.parse(result);

        expect(parsed).toHaveLength(3);
        expect(parsed[0].name).toBe('prod-cluster-us-central1');
        expect(parsed[0].status).toBe('RUNNING');
    });

    it('get_cluster_status returns healthy for prod', async () => {
        const result = await get_cluster_status({ cluster_id: 'prod-cluster-1' });
        const parsed = JSON.parse(result);

        expect(parsed.status).toBe('HEALTHY');
        expect(parsed.alerts).toHaveLength(0);
    });

    it('get_cluster_status returns warning for dev', async () => {
        const result = await get_cluster_status({ cluster_id: 'dev-cluster-1' });
        const parsed = JSON.parse(result);

        expect(parsed.status).toBe('WARNING');
        expect(parsed.alerts).toHaveLength(2);
    });

    it('scale_deployment returns success message', async () => {
        const result = await scale_deployment({
            deployment: 'frontend',
            replicas: 5,
            namespace: 'production'
        });
        const parsed = JSON.parse(result);

        expect(parsed.status).toBe('SUCCESS');
        expect(parsed.message).toContain('scaled to 5 replicas');
    });

    it('list_instances returns mocked VMs', async () => {
        const result = await list_instances();
        const parsed = JSON.parse(result);

        expect(parsed).toHaveLength(3);
        expect(parsed[0].name).toBe('web-server-01');
    });

    it('restart_service returns success', async () => {
        const result = await restart_service({ service_name: 'payment-service' });
        const parsed = JSON.parse(result);

        expect(parsed.status).toBe('SUCCESS');
        expect(parsed.message).toContain('restarted successfully');
    });
});
