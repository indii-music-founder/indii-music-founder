import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerComputerHandlers } from './computer';

const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    showMessageBox: vi.fn().mockResolvedValue({ response: 1 }),
    auth: { authorize: vi.fn(), consume: vi.fn(), beginDrive: vi.fn(), consumeDriveAction: vi.fn(), revoke: vi.fn(), revokeAllDriveSessions: vi.fn() },
    execution: {
        getPermissionStatus: vi.fn(() => ({ supported: true })), screenshot: vi.fn().mockResolvedValue({ base64: 'secret' }), listApps: vi.fn().mockResolvedValue([]),
        openApp: vi.fn(), click: vi.fn(), key: vi.fn(), scroll: vi.fn(), abort: vi.fn(), isAborted: vi.fn(() => false),
    },
}));
vi.mock('electron', () => ({ ipcMain: mocks.ipcMain, dialog: { showMessageBox: mocks.showMessageBox }, BrowserWindow: { fromWebContents: vi.fn(() => null) }, app: { isPackaged: false, getAppPath: () => '/app', getPath: () => '/tmp' } }));
vi.mock('electron-log', () => ({ default: { info: vi.fn(), error: vi.fn() } }));
vi.mock('../services/ComputerExecutionService', () => ({ computerExecutionService: mocks.execution }));
vi.mock('../services/computer/ComputerAllowlistStore', () => ({ computerAllowlistStore: { getAll: vi.fn(() => ['Safari']) } }));
vi.mock('../services/computer/ComputerAuthorizationService', () => ({ ComputerAuthorizationService: class { constructor() { return mocks.auth; } } }));
vi.mock('../services/computer/FirebaseComputerAuthorizationBackend', () => ({ FirebaseComputerAuthorizationBackend: class {} }));

describe('Computer IPC main-process security boundary', () => {
    let handlers: Record<string, (...args: any[]) => Promise<any>>;
    const good = { sender: { id: 7 }, senderFrame: { url: 'file:///app/index.html' } };
    const bad = { sender: { id: 8 }, senderFrame: { url: 'https://evil.example' } };
    const authorization = { token: 'x'.repeat(32), rendererSessionId: 'renderer-session-1234', agentId: 'agent-1' };
    beforeEach(() => {
        vi.clearAllMocks(); handlers = {};
        mocks.showMessageBox.mockResolvedValue({ response: 1 });
        mocks.auth.authorize.mockImplementation(async ({ confirm }) => {
            const approved = await confirm({ userId: 'user-1', approvalId: 'approval-1', agentId: 'agent-1', toolName: 'computer_click', action: 'click', args: { x: 1, y: 2, button: 'left' } });
            if (!approved) throw new Error('cancelled');
            return { token: 't'.repeat(43), expiresAt: Date.now() + 60_000 };
        });
        mocks.ipcMain.handle.mockImplementation((name, handler) => { handlers[name] = handler; });
        registerComputerHandlers();
    });

    it('does not expose renderer bypass endpoints', () => {
        expect(handlers['computer:grant-session']).toBeUndefined();
        expect(handlers['computer:reset-abort']).toBeUndefined();
        expect(handlers['computer:allowlist-add']).toBeUndefined();
    });

    it('rejects direct IPC and untrusted renderer attempts before provider execution', async () => {
        const direct = await handlers['computer:click'](good, { x: 1, y: 2, button: 'left' });
        expect(direct.success).toBe(false);
        expect(mocks.execution.click).not.toHaveBeenCalled();
        const bypass = await handlers['computer:click'](bad, { x: 1, y: 2, button: 'left', authorization });
        expect(bypass.success).toBe(false);
        expect(mocks.execution.click).not.toHaveBeenCalled();
    });

    it('requires a main-owned native confirmation before issuing authorization', async () => {
        const request = { idToken: 'i'.repeat(32), approvalId: 'approval-1', rendererSessionId: 'renderer-session-1234' };
        const accepted = await handlers['computer:authorize-approval'](good, request);
        expect(accepted.success).toBe(true);
        expect(mocks.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({ title: 'Approve computer control', defaultId: 0 }));
        mocks.showMessageBox.mockResolvedValueOnce({ response: 0 });
        const cancelled = await handlers['computer:authorize-approval'](good, request);
        expect(cancelled.success).toBe(false);
    });

    it('executes only after the main authorization service consumes the exact action', async () => {
        const result = await handlers['computer:click'](good, { x: 1, y: 2, button: 'left', authorization });
        expect(result.success).toBe(true);
        expect(mocks.auth.consume).toHaveBeenCalledWith(expect.objectContaining({ rendererId: 7, toolName: 'computer_click', action: 'click', args: { x: 1, y: 2, button: 'left' } }));
        expect(mocks.execution.click).toHaveBeenCalledOnce();
    });

    it('abort wins before authorization and revokes composite grants', async () => {
        mocks.execution.isAborted.mockReturnValueOnce(true);
        const denied = await handlers['computer:click'](good, { x: 1, y: 2, button: 'left', authorization });
        expect(denied.success).toBe(false);
        expect(mocks.auth.consume).not.toHaveBeenCalled();
        await handlers['computer:abort'](good);
        expect(mocks.auth.revokeAllDriveSessions).toHaveBeenCalledOnce();
    });

    it('always disables text injection at the boundary', async () => {
        const result = await handlers['computer:type'](good, { text: 'not logged', authorization });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Text injection is disabled/);
    });
});
