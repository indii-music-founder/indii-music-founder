import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerResult } from './test-types';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    agentSupervisor: {
        execute: vi.fn(),
        runScript: vi.fn()
    },
    accessControlService: { verifyAccess: vi.fn(() => true), grantAccess: vi.fn() },
    securityChecks: { validateSafeDistributionSource: vi.fn() },
    sftpService: { connect: vi.fn(), disconnect: vi.fn(), isConnected: vi.fn(), uploadDirectory: vi.fn() },
    validateSafeHostAsync: vi.fn(),
    credentialService: { getCredentials: vi.fn(() => null), saveCredentials: vi.fn(), deleteCredentials: vi.fn() }
}));

// Mock modules — must cover ALL imports in distribution.ts AND sftp.ts
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: { getPath: () => '/mock/user-data', getAppPath: () => '/app' }
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: mocks.accessControlService
}));

vi.mock('../utils/python-bridge', () => ({
    PythonBridge: { runScript: vi.fn() }
}));

vi.mock('../utils/AgentSupervisor', () => ({
    AgentSupervisor: mocks.agentSupervisor
}));

vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: mocks.securityChecks.validateSafeDistributionSource
}));

vi.mock('../utils/file-security', () => ({
    validateSafeAudioPath: vi.fn((p: string) => p)
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn()
}));

vi.mock('../utils/network-security', () => ({
    validateSafeHostAsync: mocks.validateSafeHostAsync,
    validateSafeUrlAsync: vi.fn(),
    validateSafeUrl: vi.fn()
}));

vi.mock('../utils/validation', () => ({
    DistributionStageReleaseSchema: { parse: vi.fn((d: unknown) => d) },
    SFTPConfigSchema: {
        parse: vi.fn((d: unknown) => d)
    },
    SftpUploadSchema: {
        parse: vi.fn((d: unknown) => d)
    }
}));

vi.mock('../services/SFTPService', () => ({
    sftpService: mocks.sftpService
}));

vi.mock('../services/CredentialService', () => ({
    credentialService: mocks.credentialService
}));

vi.mock('fs/promises', () => ({
    rm: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn()
}));

vi.mock('fs', () => ({
    default: { realpathSync: vi.fn((p: string) => p) },
    realpathSync: vi.fn((p: string) => p)
}));

vi.mock('os', () => ({ tmpdir: () => '/mock/tmp' }));

import { setupDistributionHandlers } from './distribution';
import { registerSFTPHandlers } from './sftp';

describe('🛡️ Shield: Distribution & SFTP SSRF Test', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'info').mockImplementation(() => { });
        vi.spyOn(console, 'log').mockImplementation(() => { });
        handlers = {};
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers[channel] = handler;
        });
        setupDistributionHandlers();
        registerSFTPHandlers();
    });

    const invoke = async (channel: string, ...args: unknown[]): Promise<HandlerResult> => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        const event = { senderFrame: { url: 'file:///app/index.html' }, sender: { send: vi.fn(), isDestroyed: () => false } };
        return handler(event, ...args) as Promise<HandlerResult>;
    };

    it('should BLOCK distribution:transmit to localhost (SSRF Protection)', async () => {
        // validateSafeHostAsync throws for localhost
        mocks.validateSafeHostAsync.mockRejectedValue(
            new Error('Security Violation: Access to localhost is denied.')
        );

        const config = {
            protocol: 'SFTP',
            host: '127.0.0.1',
            port: 22,
            user: 'testuser',
            password: 'password',
            localPath: '/safe/file.wav',
            remotePath: '/remote/path'
        };

        const result = await invoke('distribution:transmit', config);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation/);
        expect(mocks.agentSupervisor.execute).not.toHaveBeenCalled();
    });

    it('should BLOCK sftp:connect to localhost (SSRF Protection)', async () => {
        mocks.validateSafeHostAsync.mockRejectedValue(
            new Error('Security Violation: Access to localhost is denied.')
        );

        const config = {
            host: '127.0.0.1',
            port: 22,
            username: 'testuser',
            password: 'password'
        };

        const result = await invoke('sftp:connect', config);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation/);
        expect(mocks.sftpService.connect).not.toHaveBeenCalled();
    });

    it('should BLOCK sftp:connect to Metadata Service IP (SSRF Protection)', async () => {
        mocks.validateSafeHostAsync.mockRejectedValue(
            new Error('Security Violation: Access to Cloud Metadata services is denied.')
        );

        const config = {
            host: '169.254.169.254',
            username: 'testuser',
            password: 'password'
        };

        const result = await invoke('sftp:connect', config);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation/);
        expect(mocks.sftpService.connect).not.toHaveBeenCalled();
    });
});
