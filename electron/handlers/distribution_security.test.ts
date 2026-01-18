
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
    });
});
