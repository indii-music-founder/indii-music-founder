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
    os: { tmpdir: vi.fn(() => '/mock/tmp') },
    pythonBridge: { runScript: vi.fn() }
}));

// Mock modules
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app
}));
vi.mock('fs/promises', () => mocks.fs);
vi.mock('os', () => mocks.os);
vi.mock('../utils/python-bridge', () => ({ PythonBridge: mocks.pythonBridge }));

// Import handler setup
import { setupDistributionHandlers } from './distribution';

describe('🛡️ Shield: Distribution Security Test', () => {
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

    it('should ALLOW safe file staging', async () => {
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
});
