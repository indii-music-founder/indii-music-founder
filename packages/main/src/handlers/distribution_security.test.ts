import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HandlerResult } from './test-types';

// Define hoisted mocks first
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    agentSupervisor: {
        execute: vi.fn(),
        runScript: vi.fn()
    },
    fs: {
        realpathSync: vi.fn((p: string) => p),
    },
    app: {
        getPath: () => '/tmp',
        getAppPath: () => '/app',
        isPackaged: false
    },
    validateSafeAudioPath: vi.fn((p: string) => p),
    credentialService: { getCredentials: vi.fn(() => null), saveCredentials: vi.fn(), deleteCredentials: vi.fn() }
}));

// Mock 'electron'
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: {
        getPath: () => '/tmp',
        getAppPath: () => '/app',
        isPackaged: false
    }
}));

// Mock AgentSupervisor (the actual execution layer used by distribution.ts)
vi.mock('../utils/AgentSupervisor', () => ({
    AgentSupervisor: mocks.agentSupervisor
}));

// Mock PythonBridge (imported but superseded by AgentSupervisor)
vi.mock('../utils/python-bridge', () => ({
    PythonBridge: { runScript: vi.fn() }
}));

// Mock fs
vi.mock('fs', async () => {
    return {
        default: {
            realpathSync: mocks.fs.realpathSync
        },
        realpathSync: mocks.fs.realpathSync
    };
});

// Mock fs/promises
vi.mock('fs/promises', () => ({
    rm: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn()
}));

// Mock all security utilities
vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn()
}));

vi.mock('../utils/validation', () => ({
    DistributionStageReleaseSchema: { parse: vi.fn((d: unknown) => d) }
}));

vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: vi.fn()
}));

vi.mock('../utils/file-security', () => ({
    validateSafeAudioPath: mocks.validateSafeAudioPath
}));

vi.mock('../utils/network-security', () => ({
    validateSafeHostAsync: vi.fn(),
    validateSafeUrlAsync: vi.fn(),
    validateSafeUrl: vi.fn()
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: { verifyAccess: vi.fn(() => true) }
}));

vi.mock('../services/CredentialService', () => ({
    credentialService: mocks.credentialService
}));

vi.mock('os', () => ({ tmpdir: () => '/tmp' }));

// Import handler setup
import { setupDistributionHandlers } from './distribution';

describe('🛡️ Shield: Distribution Security', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'log').mockImplementation(() => { });
        handlers = {};

        // Capture handlers
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers[channel] = handler;
        });

        // Register
        setupDistributionHandlers();
    });

    afterEach(() => {
        vi.resetModules();
    });

    const invokeHandler = async (channel: string, ...args: unknown[]): Promise<HandlerResult> => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`Handler for ${channel} not found`);
        const event = { senderFrame: { url: 'file:///app/index.html' }, sender: { send: vi.fn(), isDestroyed: () => false } };
        return handler(event, ...args) as Promise<HandlerResult>;
    };

    it('should BLOCK execution of forensics on non-audio files', async () => {
        const maliciousPath = '/tmp/malware.exe';
        mocks.fs.realpathSync.mockReturnValue(maliciousPath);

        // validateSafeAudioPath throws for .exe
        mocks.validateSafeAudioPath.mockImplementation(() => {
            throw new Error("Security Violation: File type '.exe' is not allowed");
        });

        const result = await invokeHandler('distribution:run-forensics', maliciousPath);

        expect(result).toHaveProperty('success', false);
        expect(result.error).toMatch(/Security Violation|Validation Error|File type/);

        // Ensure AgentSupervisor was NOT called
        expect(mocks.agentSupervisor.execute).not.toHaveBeenCalled();
    });

    it('should BLOCK execution of forensics on system files', async () => {
        const maliciousPath = '/etc/passwd';
        mocks.fs.realpathSync.mockReturnValue(maliciousPath);

        // validateSafeAudioPath throws for system paths
        mocks.validateSafeAudioPath.mockImplementation(() => {
            throw new Error("Security Violation: Access to system directory '/etc/passwd' is denied");
        });

        const result = await invokeHandler('distribution:run-forensics', maliciousPath);

        expect(result).toHaveProperty('success', false);
        expect(mocks.agentSupervisor.execute).not.toHaveBeenCalled();
    });
});
