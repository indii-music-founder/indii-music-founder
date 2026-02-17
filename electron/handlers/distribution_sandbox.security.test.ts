import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

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
    app: { getPath: vi.fn(() => '/mock/user-data') },
    fs: {
        rm: vi.fn(),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        copyFile: vi.fn(),
        stat: vi.fn(),
        lstat: vi.fn(), // For symlink checks
    },
    fsSync: {
        realpathSync: vi.fn((p) => p),
        existsSync: vi.fn(() => true)
    },
    os: { tmpdir: vi.fn(() => '/mock/tmp') },
    pythonBridge: { runScript: vi.fn() }
}));

// Mock Modules
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
vi.mock('../utils/python-bridge', () => ({ PythonBridge: mocks.pythonBridge }));

// Import the handler setup function
import { setupDistributionHandlers } from './distribution';

describe('🛡️ Shield: Distribution Sandbox Escape Test', () => {
    let handlers: Record<string, any> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};

        // Intercept handler registration
        mocks.ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        });

        setupDistributionHandlers();

        // Reset realpathSync to identity by default
        mocks.fsSync.realpathSync.mockImplementation((p) => p);
    });

    const invoke = async (channel: string, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`Handler for ${channel} not found`);
        // Mock a secure internal sender
        const event = { senderFrame: { url: 'file:///app/index.html' } };
        return handler(event, ...args);
    };

    const validUUID = '123e4567-e89b-12d3-a456-426614174000';

    // ------------------------------------------------------------------------
    // SCENARIO 1: Path Traversal (Destination)
    // ------------------------------------------------------------------------
    it('should BLOCK attempts to write files outside the staging directory (Path Traversal)', async () => {
        // Attack: Try to write to /etc/passwd via "../../"
        // This simulates the Agent trying to overwrite system files
        const maliciousFiles = [{
            type: 'content',
            name: '../../../../etc/passwd',
            data: 'root:x:0:0:root:/root:/bin/bash'
        }];

        const result = await invoke('distribution:stage-release', validUUID, maliciousFiles);

        // Assertions
        expect(result.success).toBe(false);
        // Should be caught by Zod validation ("File name must not contain path traversal characters")
        // or by the manual check in the handler.
        expect(result.error).toMatch(/File name must not contain path traversal characters/);

        // CRITICAL: Ensure no file write occurred
        expect(mocks.fs.writeFile).not.toHaveBeenCalled();
    });

    // ------------------------------------------------------------------------
    // SCENARIO 2: Local File Inclusion (LFI) via Source Path
    // ------------------------------------------------------------------------
    it('should BLOCK attempts to read sensitive system files (LFI)', async () => {
        // Attack: Agent tries to "package" the system password file
        const sensitivePath = process.platform === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/passwd';

        mocks.fsSync.realpathSync.mockReturnValue(sensitivePath);

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

    // ------------------------------------------------------------------------
    // SCENARIO 3: Accessing Hidden Directories (e.g. ~/.ssh)
    // ------------------------------------------------------------------------
    it('should BLOCK attempts to read from hidden user directories (~/.ssh)', async () => {
        // Attack: Agent tries to steal SSH keys
        const sshKeyPath = '/Users/victim/.ssh/id_rsa';

        mocks.fsSync.realpathSync.mockReturnValue(sshKeyPath);

        const maliciousFiles = [{
            type: 'path',
            name: 'stolen_key.txt', // Rename to valid extension
            data: sshKeyPath
        }];

        const result = await invoke('distribution:stage-release', validUUID, maliciousFiles);

        expect(result.success).toBe(false);
        // Should be blocked because .ssh is hidden
        expect(result.error).toMatch(/Security Violation: Access to .* is denied/);
        expect(mocks.fs.copyFile).not.toHaveBeenCalled();
    });

    // ------------------------------------------------------------------------
    // SCENARIO 4: Symlink Attack (Bypassing Checks)
    // ------------------------------------------------------------------------
    it('should BLOCK Symlink attacks pointing to sensitive files', async () => {
        // Attack: Use a valid-looking path that is actually a symlink to /etc/passwd
        const innocentLookingPath = '/Users/victim/Music/my_song.mp3'; // Valid extension
        const realTarget = '/etc/passwd'; // System file

        // Mock realpathSync to reveal the deception
        mocks.fsSync.realpathSync.mockReturnValue(realTarget);

        const maliciousFiles = [{
            type: 'path',
            name: 'song.mp3',
            data: innocentLookingPath
        }];

        const result = await invoke('distribution:stage-release', validUUID, maliciousFiles);

        expect(result.success).toBe(false);
        // Should fail because the RESOLVED path is in a system root or has invalid extension (if /etc/passwd doesn't match allowed)
        // /etc/passwd has no extension, so it fails extension check too.
        // But system root check comes first usually.
        expect(result.error).toMatch(/Security Violation/);
        expect(mocks.fs.copyFile).not.toHaveBeenCalled();
    });

    // ------------------------------------------------------------------------
    // SCENARIO 5: Extension Whitelist Bypass
    // ------------------------------------------------------------------------
    it('should BLOCK files with dangerous extensions (.exe, .sh)', async () => {
        const dangerousPath = '/mock/tmp/malware.exe';
        mocks.fsSync.realpathSync.mockReturnValue(dangerousPath);

        const maliciousFiles = [{
            type: 'path',
            name: 'game.exe',
            data: dangerousPath
        }];

        const result = await invoke('distribution:stage-release', validUUID, maliciousFiles);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation: File type '.exe' is not allowed/);
    });

    // ------------------------------------------------------------------------
    // SCENARIO 6: Valid Operation (Baseline)
    // ------------------------------------------------------------------------
    it('should ALLOW valid operations to verify the test harness works', async () => {
        const safePath = '/mock/tmp/song.wav';
        mocks.fsSync.realpathSync.mockReturnValue(safePath);

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
