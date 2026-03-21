import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerResult } from './test-types';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    pythonBridge: { runScript: vi.fn() },
    accessControlService: { verifyAccess: vi.fn(() => true) },
    securityChecks: { validateSafeDistributionSource: vi.fn() },
    sftpService: { connect: vi.fn(), disconnect: vi.fn(), isConnected: vi.fn() }
}));

// Mock modules
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: { getPath: () => '/mock/user-data', getAppPath: () => '/app' }
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: mocks.accessControlService
}));

vi.mock('../utils/python-bridge', () => ({
    PythonBridge: mocks.pythonBridge
}));

vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: mocks.securityChecks.validateSafeDistributionSource
}));

vi.mock('../services/SFTPService', () => ({
    sftpService: mocks.sftpService
}));

import { setupDistributionHandlers } from './distribution';
import { registerSFTPHandlers } from './sftp';

describe('🛡️ Shield: Distribution & SFTP SSRF Test', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};
        mocks.ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        });
        setupDistributionHandlers();
        registerSFTPHandlers();
    });

    const invoke = async (channel: string, ...args: unknown[]): Promise<HandlerResult> => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        const event = { senderFrame: { url: 'file:///app/index.html' }, sender: { send: vi.fn() } };
        return handler(event, ...args) as Promise<HandlerResult>;
    };

    it('should BLOCK distribution:transmit to localhost (SSRF Protection)', async () => {
        const config = {
            protocol: 'SFTP',
            host: '127.0.0.1', // Blocked IP
            port: 22,
            user: 'testuser',
            password: 'password',
            localPath: '/safe/file.wav',
            remotePath: '/remote/path'
        };

        const result = await invoke('distribution:transmit', config);

        expect(result.success).toBe(false);
        // Expect security violation error
        expect(result.error).toMatch(/Security Violation/);

        // Ensure Python Bridge was NOT called
        expect(mocks.pythonBridge.runScript).not.toHaveBeenCalled();
    });

    it('should BLOCK sftp:connect to localhost (SSRF Protection)', async () => {
        const config = {
            host: '127.0.0.1', // Blocked IP
            port: 22,
            username: 'testuser',
            password: 'password'
        };

        const result = await invoke('sftp:connect', config);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation/);

        // Ensure SFTP Service was NOT called
        expect(mocks.sftpService.connect).not.toHaveBeenCalled();
    });

    it('should BLOCK sftp:connect to Metadata Service IP (SSRF Protection)', async () => {
        const config = {
            host: '169.254.169.254', // Blocked IP
            username: 'testuser',
            password: 'password'
        };

        const result = await invoke('sftp:connect', config);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation/);

        expect(mocks.sftpService.connect).not.toHaveBeenCalled();
    });
});
