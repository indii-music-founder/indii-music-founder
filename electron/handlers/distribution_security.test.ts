
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HandlerResult } from './test-types';

// Define hoisted mocks first
// Define hoisted mocks first
const mocks = vi.hoisted(() => ({
    ipcMain: {
        handle: vi.fn()
    },
    PythonBridge: {
        runScript: vi.fn()
    },
    fs: {
        realpathSync: vi.fn((p) => p),
    },
    app: {
        getPath: () => '/tmp',
        getAppPath: () => '/app',
        isPackaged: false
    }
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

// Mock PythonBridge
vi.mock('../utils/python-bridge', () => ({
    PythonBridge: mocks.PythonBridge
}));

// Mock fs
vi.mock('fs', async () => {
    return {
        default: {
            realpathSync: mocks.fs.realpathSync
        },
        realpathSync: mocks.fs.realpathSync
    }
});

// Mock fs/promises (needed because distribution.ts imports it)
vi.mock('fs/promises', () => ({
    rm: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn()
}));

// Import handler setup
import { setupDistributionHandlers } from './distribution';

describe('🛡️ Shield: Distribution Security', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
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
        const event = { senderFrame: { url: 'file:///app/index.html' } };
        return handler(event, ...args) as Promise<HandlerResult>;
    };

    it('should BLOCK execution of forensics on non-audio files', async () => {
        const maliciousPath = '/tmp/malware.exe';
        mocks.fs.realpathSync.mockReturnValue(maliciousPath);

        const result = await invokeHandler('distribution:run-forensics', maliciousPath);

        // Expect validation error (Security Violation)
        expect(result).toHaveProperty('success', false);
        expect(result.error).toMatch(/Security Violation|Validation Error|File type/);

        // Ensure Python script was NOT executed
        expect(mocks.PythonBridge.runScript).not.toHaveBeenCalled();
    });

    it('should BLOCK execution of forensics on system files', async () => {
        const maliciousPath = '/etc/passwd';
        mocks.fs.realpathSync.mockReturnValue(maliciousPath);

        const result = await invokeHandler('distribution:run-forensics', maliciousPath);

        expect(result).toHaveProperty('success', false);
        expect(mocks.PythonBridge.runScript).not.toHaveBeenCalled();
    });
});
