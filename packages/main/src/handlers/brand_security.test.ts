import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HandlerResult } from './test-types';

// Define hoisted mocks first
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    agentSupervisor: {
        execute: vi.fn(),
        runScript: vi.fn()
    },
    accessControl: {
        verifyAccess: vi.fn(() => true)
    },
    fs: {
        realpathSync: vi.fn((p: string) => p),
    },
    app: {
        getPath: () => '/tmp',
        getAppPath: () => '/app',
        isPackaged: false
    },
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

// Mock AgentSupervisor (the actual execution layer)
vi.mock('../utils/AgentSupervisor', () => ({
    AgentSupervisor: mocks.agentSupervisor
}));

// Mock python-bridge (imported by some handlers but superseded by AgentSupervisor)
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
    BrandConsistencySchema: { parse: vi.fn((d: unknown) => d) },
    ScanSchema: { parse: vi.fn((d: unknown) => d) },
    DistributionStageReleaseSchema: { parse: vi.fn((d: unknown) => d) }
}));

vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: vi.fn()
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
    accessControlService: mocks.accessControl
}));

vi.mock('../services/CredentialService', () => ({
    credentialService: mocks.credentialService
}));

vi.mock('../services/AuthStorage', () => ({
    authStorage: { getSession: vi.fn(() => null), setSession: vi.fn(), clearSession: vi.fn() }
}));

vi.mock('os', () => ({ tmpdir: () => '/tmp' }));

vi.mock('libsodium-wrappers', () => ({
    default: { ready: Promise.resolve() }
}));

vi.mock('crypto', () => ({ createCipheriv: vi.fn(), randomBytes: vi.fn() }));

// Import handler setups
import { registerBrandHandlers } from './brand';
import { registerSecurityHandlers } from './security';

describe('🛡️ Shield: file-exfiltration gates on model-bound handlers', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        vi.spyOn(console, 'warn').mockImplementation(() => { });
        vi.spyOn(console, 'log').mockImplementation(() => { });
        handlers = {};

        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers[channel] = handler;
        });

        registerBrandHandlers();
        registerSecurityHandlers();
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

    it('BLOCKS brand:analyze-consistency when the asset was never authorized', async () => {
        // Path passes the schema (extension + no traversal) but the access
        // control service denies it — e.g. /Users/me/.ssh/keys.png.
        mocks.accessControl.verifyAccess.mockReturnValue(false);

        const result = await invokeHandler('brand:analyze-consistency', '/Users/me/.ssh/keys.png', { colors: ['#fff'] });

        expect(result).toHaveProperty('success', false);
        expect((result as { error?: string }).error).toMatch(/Security Violation/);

        // The python script that reads the file bytes and sends them to the
        // model provider must never be invoked.
        expect(mocks.agentSupervisor.execute).not.toHaveBeenCalled();
    });

    it('ALLOWS brand:analyze-consistency for an authorized asset', async () => {
        mocks.accessControl.verifyAccess.mockReturnValue(true);
        mocks.agentSupervisor.execute.mockResolvedValue({ success: true, report: { score: 92 } });

        const result = await invokeHandler('brand:analyze-consistency', '/Users/me/Documents/indii/art/cover.png', { colors: ['#fff'] });

        expect(result).toHaveProperty('success', true);
        expect(mocks.agentSupervisor.execute).toHaveBeenCalledWith(
            'brand',
            'analyze_brand_consistency.py',
            ['/Users/me/Documents/indii/art/cover.png', expect.any(String)],
            { timeoutMs: 60000 }
        );
    });

    it('BLOCKS security:scan-vulnerabilities for an unauthorized scope', async () => {
        mocks.accessControl.verifyAccess.mockReturnValue(false);

        const result = await invokeHandler('security:scan-vulnerabilities', { scope: '/Users/me/.aws' });

        expect(result).toHaveProperty('success', false);
        expect((result as { error?: string }).error).toMatch(/Security Violation/);
        expect(mocks.agentSupervisor.execute).not.toHaveBeenCalled();
    });

    it('ALLOWS security:scan-vulnerabilities for an authorized scope', async () => {
        mocks.accessControl.verifyAccess.mockReturnValue(true);
        mocks.agentSupervisor.execute.mockResolvedValue({ success: true, status: 'success' });

        const result = await invokeHandler('security:scan-vulnerabilities', { scope: '/Users/me/Documents/indii' });

        expect(result).toHaveProperty('success', true);
        expect(mocks.agentSupervisor.execute).toHaveBeenCalledWith(
            'security',
            'vulnerability_scanner.py',
            ['/Users/me/Documents/indii'],
            { timeoutMs: 30000 }
        );
    });

    it('denies access for an unauthorized forensics target (sibling gate parity)', async () => {
        mocks.accessControl.verifyAccess.mockReturnValue(false);

        // Import lazily so the handler registration is captured too
        const { setupDistributionHandlers } = await import('./distribution');
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
            handlers[channel] = handler;
        });
        setupDistributionHandlers();

        const result = await invokeHandler('distribution:run-forensics', '/tmp/unauthorized.wav');

        expect(result).toHaveProperty('success', false);
        expect((result as { error?: string }).error).toMatch(/Security Violation/);
        expect(mocks.agentSupervisor.execute).not.toHaveBeenCalled();
    });
});
