import { describe, expect, it, vi } from 'vitest';
import { ComputerAuthorizationService, type ComputerAuthorizationBackend, type StoredComputerApproval } from './ComputerAuthorizationService';

const NOW = 1_700_000_000_000;
const approval = (overrides: Partial<StoredComputerApproval> = {}): StoredComputerApproval => ({
    id: 'approval-1', userId: 'user-1', agentId: 'agent-1', toolName: 'computer_click',
    args: { x: 10, y: 20, button: 'left' }, status: 'approved', createdAtMs: NOW - 1000, ...overrides,
});
function setup(overrides: Partial<ComputerAuthorizationBackend> = {}) {
    const backend: ComputerAuthorizationBackend = {
        verifyIdentity: vi.fn().mockResolvedValue({ uid: 'user-1' }),
        hasComputerControlOptIn: vi.fn().mockResolvedValue(true),
        getApproval: vi.fn().mockResolvedValue(approval()),
        ...overrides,
    };
    return { service: new ComputerAuthorizationService(backend, () => NOW), backend };
}
const authInput = { idToken: 'token', approvalId: 'approval-1', rendererId: 7, rendererSessionId: 'renderer-session-1234' };

describe('ComputerAuthorizationService boundary', () => {
    it('requires verified identity and explicit AOP opt-in', async () => {
        const invalid = setup({ verifyIdentity: vi.fn().mockRejectedValue(new Error('invalid token')) }).service;
        await expect(invalid.authorize(authInput)).rejects.toThrow('invalid token');
        const optedOut = setup({ hasComputerControlOptIn: vi.fn().mockResolvedValue(false) }).service;
        await expect(optedOut.authorize(authInput)).rejects.toThrow(/Artist Operating Profile/);
    });

    it.each([
        ['expired', approval({ createdAtMs: NOW - 600_000 }), /expired/],
        ['revoked', approval({ status: 'revoked' }), /revoked/],
        ['wrong user', approval({ userId: 'other' }), /verified user/],
    ])('rejects %s approvals', async (_name, stored, message) => {
        const service = setup({ getApproval: vi.fn().mockResolvedValue(stored) }).service;
        await expect(service.authorize(authInput)).rejects.toThrow(message as RegExp);
    });

    it('binds renderer session, tool, action, and normalized arguments', async () => {
        const { service } = setup();
        const { token } = await service.authorize(authInput);
        const base = { token, rendererId: 7, rendererSessionId: authInput.rendererSessionId, agentId: 'agent-1', toolName: 'computer_click', action: 'click' as const, args: { x: 10, y: 20 } };
        expect(() => service.consume({ ...base, rendererId: 8 })).toThrow(/different renderer/);
        expect(() => service.consume({ ...base, rendererSessionId: 'different-renderer-session' })).toThrow(/different renderer/);
        expect(() => service.consume({ ...base, agentId: 'different-agent' })).toThrow(/different agent/);
        expect(() => service.consume({ ...base, toolName: 'computer_key', action: 'key', args: { combo: 'return' } })).toThrow(/tool or action/);
        expect(() => service.consume({ ...base, args: { x: 11, y: 20 } })).toThrow(/arguments differ/);
        expect(() => service.consume(base)).not.toThrow();
    });

    it('executes an exact approval once and rejects concurrent replay', async () => {
        const { service } = setup();
        const { token } = await service.authorize(authInput);
        const input = { token, rendererId: 7, rendererSessionId: authInput.rendererSessionId, agentId: 'agent-1', toolName: 'computer_click', action: 'click' as const, args: { x: 10, y: 20, button: 'left' } };
        const attempts = await Promise.allSettled([Promise.resolve().then(() => service.consume(input)), Promise.resolve().then(() => service.consume(input))]);
        expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(attempts.filter(result => result.status === 'rejected')).toHaveLength(1);
    });

    it('limits composite drive sessions to approved internal primitives', async () => {
        const stored = approval({ toolName: 'computer_drive', args: { goal: 'Open settings', maxSteps: 2 } });
        const service = setup({ getApproval: vi.fn().mockResolvedValue(stored) }).service;
        const { token } = await service.authorize(authInput);
        const drive = service.beginDrive({ token, rendererId: 7, rendererSessionId: authInput.rendererSessionId, agentId: 'agent-1', args: stored.args });
        expect(() => service.consumeDriveAction({ sessionToken: drive.sessionToken, rendererId: 7, rendererSessionId: authInput.rendererSessionId, agentId: 'agent-1', action: 'click' })).not.toThrow();
        expect(() => service.consumeDriveAction({ sessionToken: drive.sessionToken, rendererId: 7, rendererSessionId: authInput.rendererSessionId, agentId: 'agent-1', action: 'open_app' })).toThrow(/does not cover/);
    });
});
