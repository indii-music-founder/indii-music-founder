import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    isFirebaseE2EMockEnabled: vi.fn(() => false),
    currentUser: null as { uid: string } | null,
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    getDoc: vi.fn(),
    onSnapshot: vi.fn(),
    toolRegistry: {} as Record<string, (args: unknown) => Promise<{ success: boolean; error?: string; data?: unknown }>>,
}));

vi.mock('@/utils/e2eMode', () => ({ isFirebaseE2EMockEnabled: mocks.isFirebaseE2EMockEnabled }));
vi.mock('@/utils/authGuards', () => ({
    getRealAuthenticatedUserId: (user: { uid: string } | null) => user?.uid ?? null,
}));
vi.mock('@/services/firebase', () => ({
    db: {},
    get auth() {
        return { get currentUser() { return mocks.currentUser; } };
    },
}));
vi.mock('../tools', () => ({
    get TOOL_REGISTRY() { return mocks.toolRegistry; }
}));
vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/firestore')>();
    return {
        ...actual,
        collection: vi.fn(() => ({ __collection: true })),
        doc: vi.fn(() => ({ __doc: true })),
        addDoc: mocks.addDoc,
        updateDoc: mocks.updateDoc,
        getDoc: mocks.getDoc,
        onSnapshot: mocks.onSnapshot,
        query: vi.fn((...args) => args),
        where: vi.fn(),
        orderBy: vi.fn(),
        serverTimestamp: vi.fn(() => 'server-timestamp'),
    };
});

import { toolApprovalService } from './ToolApprovalService';

describe('ToolApprovalService (ISSUE-1116)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.currentUser = { uid: 'user-1' };
        mocks.toolRegistry = {};
    });

    describe('createPendingApproval', () => {
        it('returns null and does not write when unauthenticated', async () => {
            mocks.currentUser = null;
            const id = await toolApprovalService.createPendingApproval({
                agentId: 'generalist', toolName: 'execute_code', args: {}, riskTier: 'destructive', description: 'runs code'
            });
            expect(id).toBeNull();
            expect(mocks.addDoc).not.toHaveBeenCalled();
        });

        it('persists a pending record and returns its id', async () => {
            mocks.addDoc.mockResolvedValue({ id: 'approval-1' });
            const id = await toolApprovalService.createPendingApproval({
                agentId: 'generalist', toolName: 'execute_code', args: { code: 'x' }, riskTier: 'destructive', description: 'runs code'
            });
            expect(id).toBe('approval-1');
            expect(mocks.addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ toolName: 'execute_code', status: 'pending', riskTier: 'destructive' })
            );
        });
    });

    describe('approve', () => {
        it('fails cleanly when unauthenticated', async () => {
            mocks.currentUser = null;
            const result = await toolApprovalService.approve('approval-1');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not authenticated/i);
        });

        it('fails when the approval does not exist', async () => {
            mocks.getDoc.mockResolvedValue({ exists: () => false });
            const result = await toolApprovalService.approve('missing-1');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it('refuses to re-approve an already-resolved approval', async () => {
            mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ status: 'denied', toolName: 'execute_code', args: {} }) });
            const result = await toolApprovalService.approve('approval-1');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not pending/i);
            expect(mocks.updateDoc).not.toHaveBeenCalled();
        });

        it('executes the EXACT original tool call and marks the approval executed', async () => {
            const execCode = vi.fn().mockResolvedValue({ success: true, data: 'ran ok' });
            mocks.toolRegistry = { execute_code: execCode };
            mocks.getDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ status: 'pending', toolName: 'execute_code', args: { code: 'print(1)' } })
            });

            const result = await toolApprovalService.approve('approval-1');

            expect(execCode).toHaveBeenCalledWith({ code: 'print(1)' });
            expect(result.success).toBe(true);
            expect(result.data).toBe('ran ok');
            // First updateDoc call marks 'approved' (before execution), second marks 'executed'.
            expect(mocks.updateDoc).toHaveBeenCalledTimes(2);
            expect(mocks.updateDoc).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({ status: 'approved' }));
            expect(mocks.updateDoc).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ status: 'executed' }));
        });

        it('marks the approval failed when the tool no longer exists in the registry', async () => {
            mocks.toolRegistry = {};
            mocks.getDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ status: 'pending', toolName: 'deleted_tool', args: {} })
            });
            const result = await toolApprovalService.approve('approval-1');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found in registry/i);
            expect(mocks.updateDoc).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ status: 'failed' }));
        });

        it('marks the approval failed (not thrown) when the tool itself throws', async () => {
            mocks.toolRegistry = { execute_code: vi.fn().mockRejectedValue(new Error('sandbox crashed')) };
            mocks.getDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ status: 'pending', toolName: 'execute_code', args: {} })
            });
            const result = await toolApprovalService.approve('approval-1');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/sandbox crashed/);
        });
    });

    describe('deny', () => {
        it('is a no-op when unauthenticated', async () => {
            mocks.currentUser = null;
            await toolApprovalService.deny('approval-1', 'no thanks');
            expect(mocks.updateDoc).not.toHaveBeenCalled();
        });

        it('marks the approval denied with the given reason', async () => {
            await toolApprovalService.deny('approval-1', 'too risky');
            expect(mocks.updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ status: 'denied', denyReason: 'too risky' })
            );
        });
    });

    describe('onPendingApprovals', () => {
        it('returns a no-op unsubscribe when unauthenticated', () => {
            mocks.currentUser = null;
            const callback = vi.fn();
            const unsub = toolApprovalService.onPendingApprovals(callback);
            expect(typeof unsub).toBe('function');
            expect(callback).not.toHaveBeenCalled();
            expect(mocks.onSnapshot).not.toHaveBeenCalled();
        });
    });
});
