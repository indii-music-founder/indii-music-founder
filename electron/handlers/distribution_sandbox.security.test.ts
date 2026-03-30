import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import type { HandlerResult } from './test-types';

// ============================================================================
// SHIELD 🛡️: SANDBOX ESCAPE PREVENTION TEST
// ============================================================================
// Target: Distribution IPC Handler (File Staging)
// Mission: Verify that the Agent cannot execute a "Jailbreak" to read or write
//          files outside the allowed staging directory.
// ============================================================================

// Hoisted Mocks
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    app: { getPath: vi.fn(() => '/mock/user-data'), getAppPath: vi.fn(() => '/app') },
    fs: {
        rm: vi.fn(),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        copyFile: vi.fn(),
        stat: vi.fn(),
        lstat: vi.fn(),
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
    validateSafeDistributionSource: vi.fn(),
    credentialService: { getCredentials: vi.fn(() => null), saveCredentials: vi.fn(), deleteCredentials: vi.fn() }
}));

// Mock Modules — must cover ALL imports in distribution.ts
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: { ...mocks.app, getAppPath: () => '/app' }
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

vi.mock('os', () => ({ ...mocks.os, default: mocks.os }));
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
            for (const file of data.files) {
                if (file.name.includes('..') || file.name.startsWith('/') || file.name.includes('\\')) {
                    throw new Error('File name must not contain path traversal characters');
                }
            }
            return data;
        })
    }
}));
vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: mocks.validateSafeDistributionSource
}));
vi.mock('../utils/file-security', () => ({
    validateSafeAudioPath: vi.fn((p: string) => p)
}));
vi.mock('../utils/network-security', () => ({
    validateSafeHostAsync: vi.fn(),
    validateSafeUrlAsync: vi.fn(),
    validateSafeUrl: vi.fn()
}));
vi.mock('../security/AccessControlService', () => ({
    accessControlService: mocks.accessControlService
}));
vi.mock('../services/CredentialService', () => ({
    credentialService: mocks.credentialService
}));

// Import the handler setup function
import { setupDistributionHandlers } from './distribution';

describe('🛡️ Shield: Distribution Sandbox Escape Test', () => {
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
        mocks.fsSync.realpathSync.mockImplementation((p: string) => p);
    });

    const invoke = async (channel: string, ...args: unknown[]): Promise<HandlerResult> => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`Handler for ${channel} not found`);
        const event = { senderFrame: { url: 'file:///app/index.html' }, sender: { send: vi.fn(), isDestroyed: () => false } };
        return handler(event, ...args) as Promise<HandlerResult>;
    };

    const validUUID = '123e4567-e89b-12d3-a456-426614174000';

    // SCENARIO 1: Path Traversal (Destination)
    it('should BLOCK attempts to write files outside the staging directory (Path Traversal)', async () => {
        const maliciousFiles = [{
            type: 'content',
            name: '../../../../etc/passwd',
            data: 'root:x:0:0:root:/root:/bin/bash'
        }];

        const result = await invoke('distribution:stage-release', validUUID, maliciousFiles);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/File name must not contain path traversal characters/);
        expect(mocks.fs.writeFile).not.toHaveBeenCalled();
    });

    // SCENARIO 2: Local File Inclusion (LFI) via Source Path
    it('should BLOCK attempts to read sensitive system files (LFI)', async () => {
        const sensitivePath = process.platform === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/passwd';
        mocks.fsSync.realpathSync.mockReturnValue(sensitivePath);

        // AccessControlService denies
        mocks.accessControlService.verifyAccess.mockReturnValue(false);

        const { DistributionStageReleaseSchema } = await import('../utils/validation');
        vi.mocked(DistributionStageReleaseSchema.parse).mockReturnValue({
            releaseId: validUUID,
            files: [{ type: 'path', name: 'innocent_config.txt', data: sensitivePath }]
        });

        const maliciousFiles = [{
            type: 'path',
            name: 'innocent_config.txt',
            data: sensitivePath
        }];

        const result = await invoke('distribution:stage-release', validUUID, maliciousFiles);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation: Access to .* is denied/);
        expect(mocks.fs.copyFile).not.toHaveBeenCalled();
    });

    // SCENARIO 3: Accessing Hidden Directories (e.g. ~/.ssh)
    it('should BLOCK attempts to read from hidden user directories (~/.ssh)', async () => {
        const sshKeyPath = '/Users/victim/.ssh/id_rsa';
        mocks.fsSync.realpathSync.mockReturnValue(sshKeyPath);
        mocks.accessControlService.verifyAccess.mockReturnValue(false);

        const { DistributionStageReleaseSchema } = await import('../utils/validation');
        vi.mocked(DistributionStageReleaseSchema.parse).mockReturnValue({
            releaseId: validUUID,
            files: [{ type: 'path', name: 'stolen_key.txt', data: sshKeyPath }]
        });

        const maliciousFiles = [{
            type: 'path',
            name: 'stolen_key.txt',
            data: sshKeyPath
        }];

        const result = await invoke('distribution:stage-release', validUUID, maliciousFiles);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation: Access to .* is denied/);
        expect(mocks.fs.copyFile).not.toHaveBeenCalled();
    });

    // SCENARIO 4: Symlink Attack (Bypassing Checks)
    it('should BLOCK Symlink attacks pointing to sensitive files', async () => {
        const innocentLookingPath = '/Users/victim/Music/my_song.mp3';
        const realTarget = '/etc/passwd';

        mocks.fsSync.realpathSync.mockReturnValue(realTarget);
        mocks.accessControlService.verifyAccess.mockReturnValue(false);

        const { DistributionStageReleaseSchema } = await import('../utils/validation');
        vi.mocked(DistributionStageReleaseSchema.parse).mockReturnValue({
            releaseId: validUUID,
            files: [{ type: 'path', name: 'song.mp3', data: innocentLookingPath }]
        });

        const maliciousFiles = [{
            type: 'path',
            name: 'song.mp3',
            data: innocentLookingPath
        }];

        const result = await invoke('distribution:stage-release', validUUID, maliciousFiles);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation/);
        expect(mocks.fs.copyFile).not.toHaveBeenCalled();
    });

    // SCENARIO 5: Extension Whitelist Bypass
    it('should BLOCK files with dangerous extensions (.exe, .sh)', async () => {
        const dangerousPath = '/mock/tmp/malware.exe';
        mocks.fsSync.realpathSync.mockReturnValue(dangerousPath);
        mocks.accessControlService.verifyAccess.mockReturnValue(true);

        // validateSafeDistributionSource throws for .exe extension
        mocks.validateSafeDistributionSource.mockImplementation(() => {
            throw new Error("Security Violation: File type '.exe' is not allowed for distribution");
        });

        const { DistributionStageReleaseSchema } = await import('../utils/validation');
        vi.mocked(DistributionStageReleaseSchema.parse).mockReturnValue({
            releaseId: validUUID,
            files: [{ type: 'path', name: 'game.exe', data: dangerousPath }]
        });

        const maliciousFiles = [{
            type: 'path',
            name: 'game.exe',
            data: dangerousPath
        }];

        const result = await invoke('distribution:stage-release', validUUID, maliciousFiles);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation: File type '.exe' is not allowed/);
    });

    // SCENARIO 6: Valid Operation (Baseline)
    it('should ALLOW valid operations to verify the test harness works', async () => {
        const safePath = '/mock/tmp/song.wav';
        mocks.fsSync.realpathSync.mockReturnValue(safePath);
        mocks.accessControlService.verifyAccess.mockReturnValue(true);
        mocks.validateSafeDistributionSource.mockImplementation(() => { }); // no-op = safe

        const { DistributionStageReleaseSchema } = await import('../utils/validation');
        vi.mocked(DistributionStageReleaseSchema.parse).mockReturnValue({
            releaseId: validUUID,
            files: [{ type: 'path', name: 'song.wav', data: safePath }]
        });

        const validFiles = [{
            type: 'path',
            name: 'song.wav',
            data: safePath
        }];

        const result = await invoke('distribution:stage-release', validUUID, validFiles);

        expect(result.success).toBe(true);
        expect(mocks.fs.copyFile).toHaveBeenCalled();
    });
});
