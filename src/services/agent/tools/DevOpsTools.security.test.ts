import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevOpsTools } from './DevOpsTools';

// 1. Hoist mocks so they can be referenced inside vi.mock factories
const { requestApprovalMock, httpsCallableMock } = vi.hoisted(() => ({
    requestApprovalMock: vi.fn(),
    httpsCallableMock: vi.fn()
}));

// 2. Mock the Store (User Approval Guardrail)
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            requestApproval: requestApprovalMock
        })
    }
}));

// 3. Mock Firebase Functions (The Dangerous Backend)
vi.mock('@/services/firebase', () => ({
    functions: {}, // Just an empty object since httpsCallable uses it as reference
    auth: { currentUser: { uid: 'test-guardian' } }
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: (functionsInstance: any, name: string) => {
        return (data: any) => httpsCallableMock(name, data);
    }
}));

describe('🛡️ Shield: DevOps Tools Security Sandbox', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('restart_service (Destructive Action)', () => {
        const RESTART_PAYLOAD = {
            instance_name: 'prod-db-primary',
            zone: 'us-central1-a'
        };

        it('should BLOCK execution when User DENIES approval (Sandbox Active)', async () => {
            // Arrange: User says NO
            requestApprovalMock.mockResolvedValue(false);

            // Act: Agent attempts to restart DB
            const result = await DevOpsTools.restart_service(RESTART_PAYLOAD);

            // Assert: Tool should fail
            expect(result.success).toBe(false);
            expect(result.error).toContain('User denied');
            expect(result.metadata?.errorCode).toBe('APPROVAL_DENIED');

            // CRITICAL: Ensure the backend function was NEVER called
            expect(httpsCallableMock).not.toHaveBeenCalled();
            expect(requestApprovalMock).toHaveBeenCalledWith(
                expect.stringContaining('Restart Instance'),
                expect.anything()
            );
        });

        it('should ALLOW execution when User APPROVES (Authorized)', async () => {
            // Arrange: User says YES
            requestApprovalMock.mockResolvedValue(true);
            httpsCallableMock.mockResolvedValue({
                data: { success: true, operation: 'op-123' }
            });

            // Act
            const result = await DevOpsTools.restart_service(RESTART_PAYLOAD);

            // Assert
            expect(result.success).toBe(true);
            expect(httpsCallableMock).toHaveBeenCalledWith('restartGCEInstance', expect.objectContaining({
                instanceName: 'prod-db-primary'
            }));
        });
    });

    describe('scale_deployment (Infrastructure Mutation)', () => {
        const SCALE_PAYLOAD = {
            cluster_id: 'prod-cluster',
            nodePoolName: 'default-pool',
            nodeCount: 100 // Maliciously high scale
        };

        it('should BLOCK massive scaling attempts without approval', async () => {
            // Arrange: User says NO
            requestApprovalMock.mockResolvedValue(false);

            // Act
            const result = await DevOpsTools.scale_deployment(SCALE_PAYLOAD);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toContain('User denied');
            expect(httpsCallableMock).not.toHaveBeenCalled();
        });
    });

    describe('Safe Read-Only Operations', () => {
        it('should NOT require approval for listing instances', async () => {
            // Arrange
            httpsCallableMock.mockResolvedValue({
                data: { instances: [] }
            });

            // Act
            await DevOpsTools.list_instances({});

            // Assert
            expect(requestApprovalMock).not.toHaveBeenCalled();
            expect(httpsCallableMock).toHaveBeenCalledWith('listGCEInstances', expect.anything());
        });
    });
});
