import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';

// Define hoisted mocks
const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn()
    },
    app: {
        getPath: vi.fn((name) => {
            if (name === 'userData') return '/mock/user-data';
            return '';
        })
    },
    sftpService: {
        connect: vi.fn(),
        uploadDirectory: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn()
    },
    // Mock for BrowserWindow
    BrowserWindow: {
        fromWebContents: () => ({ setContentProtection: vi.fn() })
    }
}));

// Mock 'os' module
vi.mock('os', () => ({
    default: {
        tmpdir: () => '/mock/tmp'
    },
    tmpdir: () => '/mock/tmp'
}));

// Mock 'fs' module
vi.mock('fs', () => ({
    default: {
        realpathSync: vi.fn((p) => p), // Default to returning input path
    },
    realpathSync: vi.fn((p) => p),
}));

// Mock 'electron'
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: mocks.app,
    BrowserWindow: mocks.BrowserWindow
}));

// Mock the internal SFTP Service
vi.mock('../services/SFTPService', () => ({
    sftpService: mocks.sftpService
}));

// Import the handler registration function
import { registerSFTPHandlers } from './sftp';

describe('🛡️ Shield: SFTP Security Integration Test', () => {
    let handlers: Record<string, (...args: any[]) => any> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};

        // Capture handlers when they are registered
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: any[]) => any) => {
            handlers[channel] = handler;
        });

        // Register the handlers
        registerSFTPHandlers();
    });

    afterEach(() => {
        vi.resetModules();
    });

    // Helper to invoke the handler
    const invokeHandler = async (channel: string, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`Handler for ${channel} not found`);

        // Mock event object with secure sender
        const event = {
            senderFrame: { url: 'file:///app/index.html' }
        };

        return handler(event, ...args);
    };

    it('should BLOCK upload from unauthorized system directories (Sandbox Escape Attempt)', async () => {
        // Attempt to upload /etc (Linux) or C:\Windows (Windows)
        // We use a path that is definitely not in /mock/tmp or /mock/user-data
        const sensitivePath = process.platform === 'win32' ? 'C:\\Windows\\System32' : '/etc';

        const result = await invokeHandler('sftp:upload-directory', sensitivePath, '/remote/upload');

        // Expect failure
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security: Access Denied/);
        expect(mocks.sftpService.uploadDirectory).not.toHaveBeenCalled();
    });

    it('should BLOCK Path Traversal attempting to escape safe directory', async () => {
        // Attempt to use .. to break out of tmp
        const maliciousPath = '/mock/tmp/../../etc/passwd';

        const result = await invokeHandler('sftp:upload-directory', maliciousPath, '/remote/upload');

        // Validation schema should catch ".." before it even reaches the root check
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Validation Error/);
        expect(mocks.sftpService.uploadDirectory).not.toHaveBeenCalled();
    });

    it('should ALLOW upload from authorized directories (e.g. tmpdir)', async () => {
        const safePath = '/mock/tmp/my-release-package';

        // Mock successful upload
        mocks.sftpService.uploadDirectory.mockResolvedValue(['file1.txt']);

        const result = await invokeHandler('sftp:upload-directory', safePath, '/remote/upload');

        expect(result.success).toBe(true);
        expect(mocks.sftpService.uploadDirectory).toHaveBeenCalledWith(safePath, '/remote/upload');
    });

    it('should ALLOW upload from authorized directories (e.g. userData)', async () => {
        const safePath = '/mock/user-data/logs';

        mocks.sftpService.uploadDirectory.mockResolvedValue(['log.txt']);

        const result = await invokeHandler('sftp:upload-directory', safePath, '/remote/upload');

        expect(result.success).toBe(true);
        expect(mocks.sftpService.uploadDirectory).toHaveBeenCalledWith(safePath, '/remote/upload');
    });

    it('should BLOCK execution from untrusted IPC sender', async () => {
        // Mock event from malicious web source
        const maliciousEvent = {
            senderFrame: { url: 'https://evil.com/exploit.html' }
        };
        const handler = handlers['sftp:upload-directory'];

        const result = await handler(maliciousEvent, '/mock/tmp/safe', '/remote');

        // It should catch the "Security: Unauthorized sender URL" error and return success: false
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security: Unauthorized sender URL/);
    });
});
