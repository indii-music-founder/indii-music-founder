import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerSFTPHandlers } from './sftp';
import { sftpService } from '../services/SFTPService';

// Mock Electron
const mockHandle = vi.fn();
vi.mock('electron', () => ({
    ipcMain: {
        handle: (channel: string, listener: any) => mockHandle(channel, listener)
    },
    app: {
        getPath: () => '/userData'
    }
}));

// Mock OS with default export support
vi.mock('os', async (importOriginal) => {
    const actual = await importOriginal<any>();
    const mockOs = {
        ...actual,
        tmpdir: () => '/tmp',
        platform: () => 'linux'
    };
    return {
        default: mockOs,
        ...mockOs
    };
});

// Mock Path with default export support
vi.mock('path', async (importOriginal) => {
    const actual = await importOriginal<any>();
    const mockPath = {
        ...actual,
        resolve: (p: string) => p, // Simple pass-through for test control
        sep: '/'
    };
    return {
        default: mockPath,
        ...mockPath
    };
});

// Mock SFTPService
vi.mock('../services/SFTPService', () => ({
    sftpService: {
        connect: vi.fn(),
        uploadDirectory: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn()
    }
}));

// Mock IPC Security
vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn()
}));

describe('🛡️ Shield: SFTP Path Containment', () => {
    let uploadHandler: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockHandle.mockClear();

        // Register handlers and capture the upload-directory listener
        registerSFTPHandlers();

        // Find the specific handler for upload-directory
        const call = mockHandle.mock.calls.find((c: any) => c[0] === 'sftp:upload-directory');
        if (call) {
            uploadHandler = call[1];
        } else {
            throw new Error('sftp:upload-directory handler not registered');
        }
    });

    it('should BLOCK upload from a directory that is a prefix match but not a child (Prefix Bypass)', async () => {
        // 🚨 SECURITY TEST: PREFIX BYPASS 🚨
        // Scenario: Allowed root is '/tmp'.
        // Attacker tries to access '/tmp_hacker/secrets'.
        // If the code uses `startsWith('/tmp')`, it incorrectly allows '/tmp_hacker'.

        const mockEvent = { senderFrame: { url: 'file://safe' } };
        const localPath = '/tmp_hacker/secrets';
        const remotePath = '/var/www';

        // We expect the handler to return { success: false } with a security error
        const result = await uploadHandler(mockEvent, localPath, remotePath);

        expect(result).toEqual(
            expect.objectContaining({
                success: false,
                error: expect.stringContaining('Security')
            })
        );

        // CRITICAL: Ensure the service was NEVER called
        expect(sftpService.uploadDirectory).not.toHaveBeenCalled();
    });

    it('should ALLOW upload from a valid subdirectory', async () => {
        const mockEvent = { senderFrame: { url: 'file://safe' } };
        const localPath = '/tmp/release_build';
        const remotePath = '/var/www';

        (sftpService.uploadDirectory as any).mockResolvedValue(['file1']);

        const result = await uploadHandler(mockEvent, localPath, remotePath);

        expect(result).toEqual(
            expect.objectContaining({ success: true })
        );
    });

    it('should BLOCK upload from a completely unrelated path', async () => {
        const mockEvent = { senderFrame: { url: 'file://safe' } };
        const localPath = '/etc/passwd';
        const remotePath = '/var/www';

        const result = await uploadHandler(mockEvent, localPath, remotePath);

        expect(result).toEqual(
            expect.objectContaining({
                success: false,
                error: expect.stringContaining('Security')
            })
        );
    });
});
