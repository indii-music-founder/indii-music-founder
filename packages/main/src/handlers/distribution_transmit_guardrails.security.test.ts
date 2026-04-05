import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupDistributionHandlers } from './distribution';
import type { HandlerResult } from './test-types';

const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    app: { getPath: vi.fn(() => '/mock/user-data'), getAppPath: vi.fn(() => '/app') },
    accessControlService: {
        verifyAccess: vi.fn(),
        grantAccess: vi.fn()
    },
    agentSupervisor: {
        execute: vi.fn(() => Promise.resolve({ status: 'SUCCESS' })),
        runScript: vi.fn(() => Promise.resolve({ status: 'SUCCESS' }))
    },
    validateSender: vi.fn(),
    validateSafeDistributionSource: vi.fn(),
    validateSafeHostAsync: vi.fn().mockResolvedValue(undefined),
    fs: {
        realpathSync: vi.fn((p: string) => p),
        existsSync: vi.fn(() => true)
    },
    credentialService: { getCredentials: vi.fn(() => null), saveCredentials: vi.fn(), deleteCredentials: vi.fn() }
}));

// Mocks — must cover ALL imports in distribution.ts
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app
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

vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender
}));

vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: mocks.validateSafeDistributionSource
}));

vi.mock('../utils/file-security', () => ({
    validateSafeAudioPath: vi.fn((p: string) => p)
}));

vi.mock('../utils/network-security', () => ({
    validateSafeHostAsync: mocks.validateSafeHostAsync,
    validateSafeUrlAsync: vi.fn(),
    validateSafeUrl: vi.fn()
}));

vi.mock('../utils/validation', () => ({
    DistributionStageReleaseSchema: { parse: vi.fn((d: unknown) => d) }
}));

vi.mock('../services/CredentialService', () => ({
    credentialService: mocks.credentialService
}));

vi.mock('fs', () => ({
    default: mocks.fs,
    realpathSync: mocks.fs.realpathSync,
    existsSync: mocks.fs.existsSync
}));

vi.mock('fs/promises', () => ({
    rm: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn()
}));

vi.mock('os', () => ({ tmpdir: () => '/mock/tmp' }));

describe('🛡️ Shield: Distribution Transmit Guardrails (IPC Bridge Safety)', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'info').mockImplementation(() => { });
        handlers = {};
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers[channel] = handler;
        });
        setupDistributionHandlers();
    });

    const invoke = async (channel: string, ...args: unknown[]): Promise<HandlerResult> => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        const event = { senderFrame: { url: 'file:///app/index.html' }, sender: { send: vi.fn(), isDestroyed: () => false } };
        return handler(event, ...args) as Promise<HandlerResult>;
    };

    it('should BLOCK transmission of unauthorized files (AccessControl Bypass)', async () => {
        const sensitiveFile = '/etc/passwd';
        mocks.accessControlService.verifyAccess.mockReturnValue(false);

        const payload = {
            protocol: 'SFTP',
            host: 'example.com',
            user: 'hacker',
            password: '123',
            localPath: sensitiveFile,
            remotePath: '/tmp'
        };

        const result = await invoke('distribution:transmit', payload);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation: Access to .* is denied/);
        expect(mocks.accessControlService.verifyAccess).toHaveBeenCalledWith(sensitiveFile);
        expect(mocks.agentSupervisor.execute).not.toHaveBeenCalled();
    });

    it('should BLOCK transmission if KEY file is unauthorized', async () => {
        const safeFile = '/Users/user/music/song.wav';
        const maliciousKey = '/Users/user/.ssh/id_rsa';

        mocks.accessControlService.verifyAccess.mockImplementation((path: string) => {
            if (path === safeFile) return true;
            if (path === maliciousKey) return false;
            return false;
        });

        const payload = {
            protocol: 'SFTP',
            host: 'example.com',
            user: 'hacker',
            key: maliciousKey,
            localPath: safeFile
        };

        const result = await invoke('distribution:transmit', payload);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation: Access to key file/);
        expect(mocks.agentSupervisor.execute).not.toHaveBeenCalled();
    });

    it('should ALLOW transmission of authorized files', async () => {
        const safeFile = '/Users/user/music/song.wav';
        mocks.accessControlService.verifyAccess.mockReturnValue(true);

        const payload = {
            protocol: 'SFTP',
            host: 'example.com',
            user: 'artist',
            password: 'secure',
            localPath: safeFile
        };

        const result = await invoke('distribution:transmit', payload);

        expect(result.success).toBe(true);
        expect(mocks.agentSupervisor.execute).toHaveBeenCalled();
    });
});
