import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    isFirebaseE2EMockEnabled: vi.fn(() => false),
    currentUser: null as { uid: string; getIdToken: () => Promise<string> } | null,
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    getDoc: vi.fn(),
    runTransaction: vi.fn(),
    httpsCallable: vi.fn(),
    onSnapshot: vi.fn(),
    toolRegistry: {} as Record<string, (args: unknown) => Promise<{ success: boolean; error?: string; data?: unknown }>>,
}));

vi.mock('@/utils/e2eMode', () => ({ isFirebaseE2EMockEnabled: mocks.isFirebaseE2EMockEnabled }));
vi.mock('@/utils/authGuards', () => ({
    getRealAuthenticatedUserId: (user: { uid: string } | null) => user?.uid ?? null,
}));
vi.mock('@/services/firebase', () => ({
    db: {},
    functions: {},
    get auth() {
        return { get currentUser() { return mocks.currentUser; } };
    },
}));
vi.mock('firebase/functions', () => ({ httpsCallable: mocks.httpsCallable }));
vi.mock('../tools', () => ({
    get TOOL_REGISTRY() { return mocks.toolRegistry; }
}));
vi.mock('firebase/firestore', async (importOriginal) => {
    const actual = await importOriginal<typeof import('firebase/firestore')>();
    return {
        ...actual,
        collection: vi.fn(() => ({ __collection: true })),
        doc: vi.fn(() => ({ id: 'approval-1', __doc: true })),
        setDoc: mocks.setDoc,
        updateDoc: mocks.updateDoc,
        getDoc: mocks.getDoc,
        runTransaction: mocks.runTransaction,
        onSnapshot: mocks.onSnapshot,
        query: vi.fn((...args) => args),
        where: vi.fn(),
        orderBy: vi.fn(),
        serverTimestamp: vi.fn(() => 'server-timestamp'),
    };
});

import { toolApprovalService } from './ToolApprovalService';
import { where } from 'firebase/firestore';

describe('ToolApprovalService (ISSUE-1116)', () => {
    async function bindApproval(toolName: string, args: Record<string, unknown>, execute: (args: Record<string, unknown>) => Promise<{ success: boolean; error?: string; data?: unknown }>) {
        await toolApprovalService.createPendingApproval({
            agentId: 'generalist', toolName, args, riskTier: 'destructive', description: 'requires approval', execute,
        });
        const record = mocks.setDoc.mock.lastCall?.[1];
        mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => record });
        return record;
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.currentUser = { uid: 'user-1', getIdToken: vi.fn().mockResolvedValue('identity-token') };
        mocks.toolRegistry = {};
        mocks.getDoc.mockResolvedValue({ exists: () => false });
        mocks.httpsCallable.mockReturnValue(vi.fn().mockResolvedValue({ data: { denied: true } }));
        mocks.runTransaction.mockImplementation(async (_db, callback) => callback({
            get: mocks.getDoc,
            update: (...args: unknown[]) => mocks.updateDoc(...args),
        }));
    });

    describe('createPendingApproval', () => {
        it('returns null and does not write when unauthenticated', async () => {
            mocks.currentUser = null;
            const id = await toolApprovalService.createPendingApproval({
                agentId: 'generalist', toolName: 'execute_code', args: {}, riskTier: 'destructive', description: 'runs code', execute: vi.fn(),
            });
            expect(id).toBeNull();
            expect(mocks.setDoc).not.toHaveBeenCalled();
        });

        it('persists a pending record and returns its id', async () => {
            const id = await toolApprovalService.createPendingApproval({
                agentId: 'generalist', toolName: 'execute_code', args: { code: 'x' }, riskTier: 'destructive', description: 'runs code', execute: vi.fn(),
            });
            expect(id).toBe('approval-1');
            expect(mocks.setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ toolName: 'execute_code', status: 'pending', riskTier: 'destructive', bindingSessionId: expect.any(String) })
            );
        });

        it('binds the selected implementation before publishing the pending record', async () => {
            mocks.setDoc.mockImplementationOnce(async (_ref, record) => {
                expect(toolApprovalService.canApproveInThisSession({ ...record, id: 'approval-1' })).toBe(true);
            });
            await toolApprovalService.createPendingApproval({
                agentId: 'generalist', toolName: 'execute_code', args: { code: 'x' }, riskTier: 'destructive', description: 'runs code', execute: vi.fn(),
            });
        });

        it('removes the local binding when pending persistence fails', async () => {
            let record: Record<string, unknown> = {};
            mocks.setDoc.mockImplementationOnce(async (_ref, value) => { record = value; throw new Error('write failed'); });
            await expect(toolApprovalService.createPendingApproval({
                agentId: 'generalist', toolName: 'execute_code', args: {}, riskTier: 'destructive', description: 'runs code', execute: vi.fn(),
            })).rejects.toThrow('write failed');
            expect(toolApprovalService.canApproveInThisSession({ ...record, id: 'approval-1' } as never)).toBe(false);
        });

        it.each([
            { value: undefined },
            { value: Number.NaN },
            { value: new Date() },
            { value: new Array<string>(2) },
        ])('rejects arguments that would change when saved as JSON', async args => {
            await expect(toolApprovalService.createPendingApproval({
                agentId: 'generalist', toolName: 'execute_code', args,
                riskTier: 'destructive', description: 'runs code', execute: vi.fn(),
            })).rejects.toThrow(/Tool arguments/);
            expect(mocks.setDoc).not.toHaveBeenCalled();
        });

        it('rejects cyclic arguments without publishing a pending approval', async () => {
            const args: Record<string, unknown> = {};
            args.self = args;
            await expect(toolApprovalService.createPendingApproval({
                agentId: 'generalist', toolName: 'execute_code', args,
                riskTier: 'destructive', description: 'runs code', execute: vi.fn(),
            })).rejects.toThrow(/Tool arguments/);
            expect(mocks.setDoc).not.toHaveBeenCalled();
        });
    });

    describe('local availability', () => {
        it('cannot approve a pending non-computer record without this renderer binding', async () => {
            const record = await bindApproval('execute_code', { code: 'safe' }, vi.fn());
            expect(toolApprovalService.canApproveInThisSession({ ...record, id: 'approval-1' })).toBe(true);
            expect(toolApprovalService.canApproveInThisSession({ ...record, id: 'other-session' })).toBe(false);
            expect(toolApprovalService.canApproveInThisSession({ ...record, id: 'approval-1', args: { code: 'altered' } })).toBe(false);
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

        it('executes the selected agent-local implementation with original arguments, even when a global tool has the same name', async () => {
            const localTool = vi.fn().mockResolvedValue({ success: true, data: 'ran ok' });
            const globalTool = vi.fn().mockResolvedValue({ success: true, data: 'wrong implementation' });
            mocks.toolRegistry = { execute_code: globalTool };
            await bindApproval('execute_code', { code: 'print(1)' }, localTool);

            const result = await toolApprovalService.approve('approval-1');

            expect(localTool).toHaveBeenCalledWith({ code: 'print(1)' });
            expect(globalTool).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.data).toBe('ran ok');
            // First updateDoc call marks 'approved' (before execution), second marks 'executed'.
            expect(mocks.updateDoc).toHaveBeenCalledTimes(2);
            expect(mocks.updateDoc).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({ status: 'approved' }));
            expect(mocks.updateDoc).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ status: 'executed' }));
        });

        it('refuses a pending record without the original renderer binding', async () => {
            mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ status: 'pending', toolName: 'deleted_tool', args: {} }) });
            const result = await toolApprovalService.approve('approval-1');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/original tool call/i);
            expect(mocks.toolRegistry.deleted_tool).toBeUndefined();
        });

        it('marks the approval failed (not thrown) when the bound tool itself throws', async () => {
            await bindApproval('execute_code', {}, vi.fn().mockRejectedValue(new Error('sandbox crashed')));
            const result = await toolApprovalService.approve('approval-1');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/sandbox crashed/);
            expect(mocks.updateDoc).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({ status: 'failed' }));
        });

        it('records a returned tool failure as failed rather than executed', async () => {
            await bindApproval('execute_code', {}, vi.fn().mockResolvedValue({ success: false, error: 'Provider rejected the action' }));
            const result = await toolApprovalService.approve('approval-1');
            expect(result.success).toBe(false);
            expect(mocks.updateDoc).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({
                status: 'failed', result: { success: false, error: 'Provider rejected the action' },
            }));
        });

        it('reports an ambiguous outcome when final result recording fails after dispatch', async () => {
            const execute = vi.fn().mockResolvedValue({ success: true });
            await bindApproval('execute_code', {}, execute);
            mocks.updateDoc.mockImplementationOnce(() => undefined).mockRejectedValueOnce(new Error('database unavailable'));
            const result = await toolApprovalService.approve('approval-1');
            expect(execute).toHaveBeenCalledOnce();
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/reconciliation/);
            expect(result.error).toMatch(/do not retry automatically/i);
        });

        it('refuses changed arguments before claiming or dispatching the approval', async () => {
            const localTool = vi.fn().mockResolvedValue({ success: true });
            const record = await bindApproval('execute_code', { code: 'safe' }, localTool);
            mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ...record, args: { code: 'altered' } }) });

            const result = await toolApprovalService.approve('approval-1');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/original tool call/i);
            expect(localTool).not.toHaveBeenCalled();
            expect(mocks.updateDoc).not.toHaveBeenCalled();
        });

        it('does not reinterpret a changed tool name as a computer approval', async () => {
            const localTool = vi.fn().mockResolvedValue({ success: true });
            const record = await bindApproval('execute_code', { code: 'safe' }, localTool);
            mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ...record, toolName: 'computer_click' }) });

            const result = await toolApprovalService.approve('approval-1');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/original tool call/i);
            expect(localTool).not.toHaveBeenCalled();
            expect(mocks.httpsCallable).not.toHaveBeenCalled();
        });

        it('dispatches only once when two approval attempts race', async () => {
            const localTool = vi.fn().mockResolvedValue({ success: true });
            const record = await bindApproval('execute_code', { code: 'safe' }, localTool);
            let status = 'pending';
            let previous = Promise.resolve();
            mocks.getDoc.mockImplementation(async () => ({ exists: () => true, data: () => ({ ...record, status }) }));
            mocks.runTransaction.mockImplementation((_db, callback) => {
                const attempt = previous.then(() => callback({
                    get: mocks.getDoc,
                    update: (_ref: unknown, patch: { status: string }) => { status = patch.status; mocks.updateDoc(_ref, patch); },
                }));
                previous = attempt.then(() => undefined, () => undefined);
                return attempt;
            });

            const results = await Promise.all([toolApprovalService.approve('approval-1'), toolApprovalService.approve('approval-1')]);
            expect(results.filter(result => result.success)).toHaveLength(1);
            expect(results.filter(result => !result.success)).toHaveLength(1);
            expect(localTool).toHaveBeenCalledTimes(1);
        });

        it('leaves computer approval transitions to main and the trusted backend', async () => {
            const computerClick = vi.fn().mockResolvedValue({ success: true });
            mocks.toolRegistry = { computer_click: computerClick };
            mocks.getDoc.mockResolvedValue({
                exists: () => true,
                data: () => ({ status: 'pending', agentId: 'agent-1', toolName: 'computer_click', args: { x: 1, y: 2 } })
            });
            Object.defineProperty(window, 'electronAPI', { configurable: true, value: { computer: { authorizeApproval: vi.fn().mockResolvedValue({ success: true, data: { token: 't'.repeat(43), expiresAt: Date.now() + 60_000 } }) } } });

            const result = await toolApprovalService.approve('approval-1');

            expect(result.success).toBe(true);
            expect(computerClick).toHaveBeenCalledWith(expect.objectContaining({ __computerAuthorizationToken: 't'.repeat(43), __computerAgentId: 'agent-1' }));
            expect(mocks.runTransaction).not.toHaveBeenCalled();
            expect(mocks.updateDoc).not.toHaveBeenCalled();
        });
    });

    describe('deny', () => {
        it('is a no-op when unauthenticated', async () => {
            mocks.currentUser = null;
            await toolApprovalService.deny('approval-1', 'no thanks');
            expect(mocks.updateDoc).not.toHaveBeenCalled();
        });

        it('marks the approval denied with the given reason', async () => {
            mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ status: 'pending', toolName: 'execute_code' }) });
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

    describe('onUnresolvedApprovals', () => {
        it('includes claimed actions that no longer appear in the pending query', () => {
            mocks.onSnapshot.mockImplementation((_query, callback) => {
                callback({ forEach: (visit: (doc: unknown) => void) => visit({
                    id: 'claimed-1', data: () => ({ status: 'claimed', toolName: 'computer_click' }),
                }) });
                return () => {};
            });
            const callback = vi.fn();
            toolApprovalService.onUnresolvedApprovals(callback);

            expect(where).toHaveBeenCalledWith('status', 'in', ['pending', 'approved', 'claimed']);
            expect(callback).toHaveBeenCalledWith([expect.objectContaining({ id: 'claimed-1', status: 'claimed' })]);
        });
    });
});
