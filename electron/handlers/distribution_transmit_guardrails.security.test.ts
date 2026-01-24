import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupDistributionHandlers } from './distribution';

const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    app: { getPath: vi.fn(() => '/mock/user-data') },
    accessControlService: {
        verifyAccess: vi.fn(),
        grantAccess: vi.fn()
    },
    pythonBridge: { runScript: vi.fn(() => Promise.resolve({ status: 'SUCCESS' })) },
    validateSender: vi.fn(),
    validateSafeDistributionSource: vi.fn(),
    fs: {
        realpathSync: vi.fn((p) => p),
        existsSync: vi.fn(() => true)
    }
}));

// Mocks
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: mocks.accessControlService
}));

vi.mock('../utils/python-bridge', () => ({
    PythonBridge: mocks.pythonBridge
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender
}));

// We can mock validation checks to pass by default to focus on AccessControl
vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: mocks.validateSafeDistributionSource
}));

vi.mock('fs', () => ({
    default: mocks.fs,
    realpathSync: mocks.fs.realpathSync,
    existsSync: mocks.fs.existsSync
}));

describe('🛡️ Shield: Distribution Transmit Guardrails (IPC Bridge Safety)', () => {
    let handlers: Record<string, any> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};
        mocks.ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        });
        setupDistributionHandlers();
    });

    const invoke = async (channel: string, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        // Fake event
        const event = { senderFrame: { url: 'file:///app/index.html' }, sender: { send: vi.fn() } };
        return handler(event, ...args);
    };

    it('should BLOCK transmission of unauthorized files (AccessControl Bypass)', async () => {
        // ARRANGE
        const sensitiveFile = '/etc/passwd';
        mocks.accessControlService.verifyAccess.mockReturnValue(false); // DENY

        const payload = {
            protocol: 'SFTP',
            host: 'example.com',
            user: 'hacker',
            password: '123',
            localPath: sensitiveFile,
            remotePath: '/tmp'
        };

        // ACT
        const result = await invoke('distribution:transmit', payload);

        // ASSERT
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation: Access to .* is denied/);
        expect(mocks.accessControlService.verifyAccess).toHaveBeenCalledWith(sensitiveFile);
        expect(mocks.pythonBridge.runScript).not.toHaveBeenCalled();
    });

    it('should BLOCK transmission if KEY file is unauthorized', async () => {
         // ARRANGE
         const safeFile = '/Users/user/music/song.wav';
         const maliciousKey = '/Users/user/.ssh/id_rsa'; // Hidden file, unauthorized

         // Mock first call (file) -> true, second call (key) -> false
         mocks.accessControlService.verifyAccess.mockImplementation((path) => {
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

         // ACT
         const result = await invoke('distribution:transmit', payload);

         // ASSERT
         expect(result.success).toBe(false);
         expect(result.error).toMatch(/Security Violation: Access to key file/);
         expect(mocks.pythonBridge.runScript).not.toHaveBeenCalled();
    });

    it('should ALLOW transmission of authorized files', async () => {
        // ARRANGE
        const safeFile = '/Users/user/music/song.wav';
        mocks.accessControlService.verifyAccess.mockReturnValue(true); // ALLOW

        const payload = {
            protocol: 'SFTP',
            host: 'example.com',
            user: 'artist',
            password: 'secure',
            localPath: safeFile
        };

        // ACT
        const result = await invoke('distribution:transmit', payload);

        // ASSERT
        expect(result.success).toBe(true);
        expect(mocks.pythonBridge.runScript).toHaveBeenCalled();
    });
});
