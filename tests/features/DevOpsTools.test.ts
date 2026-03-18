import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DevOpsTools } from '@/services/agent/tools/DevOpsTools';
import { useStore } from '@/core/store';

// Mock dependencies

// 1. Mock firebase/functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(),
    httpsCallable: (_functions: any, _name: string) => mockHttpsCallable
}));

// 2. Mock @/services/firebase
vi.mock('@/services/firebase', () => ({
    functions: {}
}));

// 3. Mock @/core/store
const mockRequestApproval = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: {
        getState: () => ({
            requestApproval: mockRequestApproval
        })
    }
}));

// Mock console to avoid noise
const consoleMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
};
global.console = { ...global.console, ...consoleMock };

describe('DevOpsTools Feature', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: User approves everything
        mockRequestApproval.mockResolvedValue(true);
    });

    describe('scale_deployment', () => {
        const validArgs = {
            cluster_id: 'prod-cluster',
            nodePoolName: 'default-pool',
            nodeCount: 5,
            projectId: 'my-project',
            location: 'us-central1'
        };

        it('should execute successfully with valid input and approval', async () => {
            // Mock backend response
            mockHttpsCallable.mockResolvedValue({
                data: { success: true, message: 'Scaled successfully' }
            });

            const result = await DevOpsTools.scale_deployment!(validArgs);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Successfully scaled');

            // Verify backend call
            expect(mockHttpsCallable).toHaveBeenCalled();
            // Verify approval was requested
            expect(mockRequestApproval).toHaveBeenCalledWith(
                expect.stringContaining('Scale Node Pool'),
                'critical'
            );
            expect(mockRequestApproval).toHaveBeenCalledWith(
                expect.stringContaining('New Node Count: 5'),
                'critical'
            );
        });

        it('should fail if nodeCount is negative', async () => {
            const result = await DevOpsTools.scale_deployment!({
                ...validArgs,
                nodeCount: -1
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe("Node count cannot be negative.");
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');

            // Ensure no side effects
            expect(mockRequestApproval).not.toHaveBeenCalled();
            expect(mockHttpsCallable).not.toHaveBeenCalled();
        });

        it('should fail if nodeCount is not an integer', async () => {
            const result = await DevOpsTools.scale_deployment!({
                ...validArgs,
                nodeCount: 5.5
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe("Node count must be an integer.");
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');

            expect(mockRequestApproval).not.toHaveBeenCalled();
            expect(mockHttpsCallable).not.toHaveBeenCalled();
        });

        it('should fail if nodeCount exceeds safety limit', async () => {
            const result = await DevOpsTools.scale_deployment!({
                ...validArgs,
                nodeCount: 101
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain("safety limit");
            expect(result.metadata?.errorCode).toBe('INVALID_INPUT');

            expect(mockRequestApproval).not.toHaveBeenCalled();
            expect(mockHttpsCallable).not.toHaveBeenCalled();
        });

        it('should fail if user denies approval', async () => {
            mockRequestApproval.mockResolvedValue(false);

            const result = await DevOpsTools.scale_deployment!(validArgs);

            expect(result.success).toBe(false);
            expect(result.error).toContain("User denied");
            expect(result.metadata?.errorCode).toBe('APPROVAL_DENIED');

            expect(mockHttpsCallable).not.toHaveBeenCalled();
        });
    });
});
