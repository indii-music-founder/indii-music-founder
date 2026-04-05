import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import type { HandlerResult } from './test-types';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    app: { getPath: vi.fn(() => '/mock/user-data'), getAppPath: vi.fn(() => '/app') },
    fs: {
        rm: vi.fn(),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        copyFile: vi.fn(),
        readFile: vi.fn(),
    },
    fsSync: {
        realpathSync: vi.fn((p: string) => p),
        existsSync: vi.fn(() => true)
    },
    os: { tmpdir: vi.fn(() => '/mock/tmp') },
    agentSupervisor: {
        execute: vi.fn(),
        runScript: vi.fn()
    },
    accessControlService: { verifyAccess: vi.fn(() => true), grantAccess: vi.fn() },
    credentialService: { getCredentials: vi.fn(() => null), saveCredentials: vi.fn(), deleteCredentials: vi.fn() }
}));

// Mock modules — must cover ALL imports in distribution.ts
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: mocks.accessControlService
}));
vi.mock('fs/promises', () => mocks.fs);
vi.mock('fs', () => ({
    default: {
        ...mocks.fsSync,
        ...mocks.fs
    },
    realpathSync: mocks.fsSync.realpathSync,
    existsSync: mocks.fsSync.existsSync
}));

vi.mock('os', () => mocks.os);
vi.mock('../utils/python-bridge', () => ({ PythonBridge: { runScript: vi.fn() } }));
vi.mock('../utils/AgentSupervisor', () => ({
    AgentSupervisor: mocks.agentSupervisor
}));
vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn()
}));
vi.mock('../utils/validation', () => ({
    DistributionStageReleaseSchema: {
        parse: vi.fn((data: { releaseId: string; files: Array<{ type: string; name: string; data: string }> }) => {
            // Replicate the real Zod validation for path traversal checks
            for (const file of data.files) {
                if (file.name.includes('..') || file.name.startsWith('/') || file.name.includes('\\')) {
                    throw Object.assign(new Error('Validation'), {
                        errors: [{ message: 'File name must not contain path traversal characters' }],
                        name: 'ZodError'
                    });
                }
            }
            return data;
        })
    }
}));
vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: vi.fn((filePath: string) => {
        // Replicate real security-checks behavior for testing
        const SYSTEM_ROOTS = ['/etc', '/var', '/usr', '/bin', '/sbin', '/proc', '/sys', '/root'];
        const normalized = path.normalize(filePath);
        const segments = normalized.split(path.sep);
        if (segments.some((s: string) => s.startsWith('.') && s !== '.' && s !== '..')) {
            throw new Error('Security Violation: Access to hidden files or directories is denied');
        }
        if (SYSTEM_ROOTS.some(root => normalized.startsWith(root))) {
            throw new Error('Security Violation: Access to system directories is denied');
        }
    })
}));
vi.mock('../utils/file-security', () => ({
    validateSafeAudioPath: vi.fn((p: string) => p)
}));
vi.mock('../utils/network-security', () => ({
    validateSafeHostAsync: vi.fn(),
    validateSafeUrlAsync: vi.fn(),
    validateSafeUrl: vi.fn()
}));
vi.mock('../services/CredentialService', () => ({
    credentialService: mocks.credentialService
}));

// Import handler setup
import { setupDistributionHandlers } from './distribution';

// Create a ZodError-compatible class for assertions
class MockZodError extends Error {
    errors: Array<{ message: string }>;
    constructor(message: string) {
        super(message);
        this.name = 'ZodError';
        this.errors = [{ message }];
    }
}

describe('🛡️ Shield: Distribution Security Test', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'info').mockImplementation(() => { });
        mocks.fsSync.realpathSync.mockImplementation((p: string) => p);

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

    const validUUID = '123e4567-e89b-12d3-a456-426614174000';

    it('should BLOCK Path Traversal when staging files (Sandbox Escape)', async () => {
        const { DistributionStageReleaseSchema } = await import('../utils/validation');
        vi.mocked(DistributionStageReleaseSchema.parse).mockImplementation(() => {
            const err = new MockZodError('File name must not contain path traversal characters');
            throw err;
        });

        const files = [{
            type: 'content',
            name: '../../../../etc/passwd',
            data: 'malicious content'
        }];

        const result = await invoke('distribution:stage-release', validUUID, files);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/File name must not contain path traversal characters/);
        expect(mocks.fs.writeFile).not.toHaveBeenCalled();
    });

    it('should BLOCK Absolute Path Injection (Sandbox Escape)', async () => {
        const { DistributionStageReleaseSchema } = await import('../utils/validation');
        vi.mocked(DistributionStageReleaseSchema.parse).mockImplementation(() => {
            const err = new MockZodError('File name must not contain path traversal characters');
            throw err;
        });

        const targetPath = process.platform === 'win32' ? 'C:\\Windows\\System32\\driver.sys' : '/etc/passwd';
        const files = [{
            type: 'content',
            name: targetPath,
            data: 'malicious content'
        }];

        const result = await invoke('distribution:stage-release', validUUID, files);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/File name must not contain path traversal characters/);
        expect(mocks.fs.writeFile).not.toHaveBeenCalled();
    });

    it('should BLOCK LFI (Local File Inclusion) from system paths', async () => {
        const { DistributionStageReleaseSchema } = await import('../utils/validation');
        const sensitivePath = process.platform === 'win32' ? 'C:\\Windows\\System32\\cmd.exe' : '/etc/passwd';

        mocks.fsSync.realpathSync.mockReturnValue(sensitivePath);

        // Schema parse succeeds (filename is valid)
        vi.mocked(DistributionStageReleaseSchema.parse).mockReturnValue({
            releaseId: validUUID,
            files: [{ type: 'path', name: 'stolen_file.txt', data: sensitivePath }]
        });

        // AccessControlService denies the system path
        mocks.accessControlService.verifyAccess.mockReturnValue(false);

        const files = [{
            type: 'path',
            name: 'stolen_file.txt',
            data: sensitivePath
        }];

        const result = await invoke('distribution:stage-release', validUUID, files);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation/);
        expect(mocks.fs.copyFile).not.toHaveBeenCalled();
    });

    it('should BLOCK Symlink Attack (Bypass via valid extension)', async () => {
        const { DistributionStageReleaseSchema } = await import('../utils/validation');
        const symlinkPath = '/Users/alice/music/song.wav';
        const targetPath = '/etc/passwd';

        mocks.fsSync.realpathSync.mockReturnValue(targetPath);

        vi.mocked(DistributionStageReleaseSchema.parse).mockReturnValue({
            releaseId: validUUID,
            files: [{ type: 'path', name: 'stolen_config.xml', data: symlinkPath }]
        });

        // AccessControlService denies the resolved path
        mocks.accessControlService.verifyAccess.mockReturnValue(false);

        const files = [{
            type: 'path',
            name: 'stolen_config.xml',
            data: symlinkPath
        }];

        const result = await invoke('distribution:stage-release', validUUID, files);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation/);
        expect(mocks.fs.copyFile).not.toHaveBeenCalled();
    });

    it('should ALLOW safe file staging via path', async () => {
        const { DistributionStageReleaseSchema } = await import('../utils/validation');
        const sourcePath = '/Users/alice/music/song.wav';
        mocks.fsSync.realpathSync.mockReturnValue(sourcePath);
        mocks.accessControlService.verifyAccess.mockReturnValue(true);

        vi.mocked(DistributionStageReleaseSchema.parse).mockReturnValue({
            releaseId: validUUID,
            files: [{ type: 'path', name: 'song.wav', data: sourcePath }]
        });

        const files = [{
            type: 'path',
            name: 'song.wav',
            data: sourcePath
        }];

        const result = await invoke('distribution:stage-release', validUUID, files);

        expect(result.success).toBe(true);
        expect(mocks.fs.copyFile).toHaveBeenCalled();
    });

    it('should ALLOW safe file staging via content', async () => {
        const { DistributionStageReleaseSchema } = await import('../utils/validation');

        vi.mocked(DistributionStageReleaseSchema.parse).mockReturnValue({
            releaseId: validUUID,
            files: [{ type: 'content', name: 'metadata.xml', data: '<xml></xml>' }]
        });

        const files = [{
            type: 'content',
            name: 'metadata.xml',
            data: '<xml></xml>'
        }];

        const result = await invoke('distribution:stage-release', validUUID, files);

        expect(result.success).toBe(true);
        expect(mocks.fs.writeFile).toHaveBeenCalled();
        const expectedPath = path.resolve('/mock/tmp/indiiOS-releases', validUUID, 'metadata.xml');
        expect(mocks.fs.writeFile).toHaveBeenCalledWith(expectedPath, '<xml></xml>', 'utf-8');
    });

    it('should BLOCK Path Traversal in package-itmsp', async () => {
        const maliciousReleaseId = '../../../../etc';

        const result = await invoke('distribution:package-itmsp', maliciousReleaseId);

        expect(result.success).toBe(false);
        // UUID validation should fail
        expect(mocks.agentSupervisor.execute).not.toHaveBeenCalled();
    });
});
