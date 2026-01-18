
import { describe, it, expect, vi, afterEach } from 'vitest';
import { setupDistributionHandlers } from './distribution';
import { ipcMain } from 'electron';
import { PythonBridge } from '../utils/python-bridge';

// Mock Electron
vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getPath: (name: string) => '/tmp'
    },
    ipcMain: {
        handle: vi.fn()
    }
}));

// Mock PythonBridge
vi.mock('../utils/python-bridge', () => ({
    PythonBridge: {
        runScript: vi.fn().mockResolvedValue({ status: 'SUCCESS', report: 'fake report' })
    }
}));

// Mock Security Utils
vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn()
}));

// Mock fs/path security - we need to make sure realpathSync works for our test case
vi.mock('fs', async (importOriginal) => {
    const mod = await importOriginal() as any;
    return {
        ...mod,
        realpathSync: vi.fn((p) => p), // Pass through for simplicity
        promises: {
            ...mod.promises,
            rm: vi.fn(),
            mkdir: vi.fn(),
            writeFile: vi.fn(),
            copyFile: vi.fn()
        }
    };
});


describe('Vulnerability: Distribution Handler Forensics', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should BLOCK executing forensics on a non-audio file', async () => {
        setupDistributionHandlers();

        // Get the registered handler
        const calls = (ipcMain.handle as any).mock.calls;
        const handlerEntry = calls.find((call: any[]) => call[0] === 'distribution:run-forensics');
        expect(handlerEntry).toBeDefined();
        const handler = handlerEntry[1];

        // Simulate a path to a non-audio file
        const maliciousPath = '/user/documents/passwords.txt';

        // Execute handler - EXPECT ERROR
        // Current implementation: Fails to check, so it proceeds to call PythonBridge
        // Desired implementation: Returns { success: false, error: "Security Violation..." }
        const result = await handler({ senderFrame: { url: 'file://app/index.html' } }, maliciousPath);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Security Violation/);

        // Verify PythonBridge was NOT called
        expect(PythonBridge.runScript).not.toHaveBeenCalled();
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    }
}));

// Mock 'electron'
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: {
        getPath: () => '/tmp'
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
    let handlers: Record<string, (...args: any[]) => any> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};

        // Capture handlers
        mocks.ipcMain.handle.mockImplementation((channel: string, handler: (...args: any[]) => any) => {
            handlers[channel] = handler;
        });

        // Register
        setupDistributionHandlers();
    });

    afterEach(() => {
        vi.resetModules();
    });

    const invokeHandler = async (channel: string, ...args: any[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`Handler for ${channel} not found`);
        const event = { senderFrame: { url: 'file:///app/index.html' } };
        return handler(event, ...args);
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
