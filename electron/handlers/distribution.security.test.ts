import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    app: { getPath: vi.fn(() => '/mock/user-data') },
    fs: {
        rm: vi.fn(),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        copyFile: vi.fn(),
        readFile: vi.fn(),
    },
    // New mock for fs (sync)
    fsSync: {
        realpathSync: vi.fn((p) => p), // Default to returning path as-is
        existsSync: vi.fn(() => true)
    },
    os: { tmpdir: vi.fn(() => '/mock/tmp') },
    pythonBridge: { runScript: vi.fn() }
}));

// Mock modules
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app
}));
vi.mock('fs/promises', () => mocks.fs);
// Mock fs default export for synchronous methods used in security checks
vi.mock('fs', () => ({
    default: {
        ...mocks.fsSync,
        ...mocks.fs // include promise methods if default export has them (node fs usually does)
    },
    realpathSync: mocks.fsSync.realpathSync,
    existsSync: mocks.fsSync.existsSync
}));

vi.mock('os', () => mocks.os);
vi.mock('../utils/python-bridge', () => ({ PythonBridge: mocks.pythonBridge }));

// Import handler setup
import { setupDistributionHandlers } from './distribution';

describe('🛡️ Shield: Distribution Security Test', () => {
    let handlers: Record<string, any> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset realpathSync to identity function by default
        mocks.fsSync.realpathSync.mockImplementation((p) => p);

        handlers = {};
        mocks.ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        });
        setupDistributionHandlers();
    });

    const invoke = async (channel: string, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        // Mock secure sender
        const event = { senderFrame: { url: 'file:///app/index.html' } };
        return handler(event, ...args);
    };

    const validUUID = '123e4567-e89b-12d3-a456-426614174000';

    it('should BLOCK Path Traversal when staging files (Sandbox Escape)', async () => {
        // Attempt to stage a file named "../../etc/passwd"
        // Layer 1 Defense: Zod Schema Validation
        const releaseId = validUUID;
        const files = [{
            type: 'content',
            name: '../../../../etc/passwd',
            data: 'malicious content'
        }];

        const result = await invoke('distribution:stage-release', releaseId, files);

        expect(result.success).toBe(false);
        // The Zod schema explicitly forbids ".." in filenames
        expect(result.error).toMatch(/File name must not contain path traversal characters/);
        expect(mocks.fs.writeFile).not.toHaveBeenCalled();
    });

    it('should BLOCK Absolute Path Injection (Sandbox Escape)', async () => {
        // Attempt to stage a file with an absolute path
        // Layer 1 Defense: Zod Schema Validation (it checks .startsWith('/'))
        const releaseId = validUUID;
        // Zod schema blocks "/" start for names
        const targetPath = process.platform === 'win32' ? 'C:\\Windows\\System32\\driver.sys' : '/etc/passwd';
        const files = [{
            type: 'content',
            name: targetPath,
            data: 'malicious content'
        }];

        const result = await invoke('distribution:stage-release', releaseId, files);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/File name must not contain path traversal characters/);
        expect(mocks.fs.writeFile).not.toHaveBeenCalled();
    });

    it('should BLOCK LFI (Local File Inclusion) from system paths', async () => {
        // Attempt to copy FROM a system path
        // This passes Zod (file.name is valid), but fails validateSafeDistributionSource
        const releaseId = validUUID;
        const sensitivePath = process.platform === 'win32' ? 'C:\\Windows\\System32\\cmd.exe' : '/etc/passwd';

        // Mock realpathSync to return the sensitive path (identity)
        mocks.fsSync.realpathSync.mockReturnValue(sensitivePath);

        const files = [{
            type: 'path',
            name: 'stolen_file.txt', // Valid destination name
            data: sensitivePath      // Invalid source path
        }];

        const result = await invoke('distribution:stage-release', releaseId, files);

        expect(result.success).toBe(false);
        // validateSafeDistributionSource checks for system roots
        expect(result.error).toMatch(/Security Violation/);
        expect(mocks.fs.copyFile).not.toHaveBeenCalled();
    });

    it('should BLOCK Symlink Attack (Bypass via valid extension)', async () => {
        const releaseId = validUUID;
        const symlinkPath = '/Users/alice/music/song.wav'; // Looks valid
        const targetPath = '/etc/passwd'; // System file

        // Mock realpathSync to simulate symlink resolution
        mocks.fsSync.realpathSync.mockReturnValue(targetPath);

        const files = [{
            type: 'path',
            name: 'stolen_config.xml',
            data: symlinkPath
        }];

        const result = await invoke('distribution:stage-release', releaseId, files);

        expect(result.success).toBe(false);
        // Should block based on resolved path
        expect(result.error).toMatch(/Security Violation/);
        expect(mocks.fs.copyFile).not.toHaveBeenCalled();
    });

    it('should ALLOW safe file staging via path', async () => {
        const releaseId = validUUID;
        const sourcePath = '/Users/alice/music/song.wav';
        mocks.fsSync.realpathSync.mockReturnValue(sourcePath);

        const files = [{
            type: 'path',
            name: 'song.wav',
            data: sourcePath
        }];

        const result = await invoke('distribution:stage-release', releaseId, files);

        expect(result.success).toBe(true);
        expect(mocks.fs.copyFile).toHaveBeenCalled();
    });

    it('should ALLOW safe file staging via content', async () => {
        const releaseId = validUUID;
        const files = [{
            type: 'content',
            name: 'metadata.xml',
            data: '<xml></xml>'
        }];

        const result = await invoke('distribution:stage-release', releaseId, files);

        expect(result.success).toBe(true);
        expect(mocks.fs.writeFile).toHaveBeenCalled();
        const expectedPath = path.resolve('/mock/tmp/indiiOS-releases', releaseId, 'metadata.xml');
        expect(mocks.fs.writeFile).toHaveBeenCalledWith(expectedPath, '<xml></xml>', 'utf-8');
    });

    it('should BLOCK Path Traversal in package-itmsp', async () => {
        const maliciousReleaseId = '../../../../etc';

        const result = await invoke('distribution:package-itmsp', maliciousReleaseId);

        // Should return failure
        expect(result.success).toBe(false);
        // Should catch validation error
        // Note: We might need to adjust the error message expectation once we implement the fix
        // For now, just checking success: false is good enough to prove it fails (currently it will likely succeed or fail differently)

        // CRITICAL: Python script should NOT be executed with malicious path
        expect(mocks.pythonBridge.runScript).not.toHaveBeenCalled();
    });
});
