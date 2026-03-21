import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupDistributionHandlers } from './distribution';

// Hoisted mocks to control behavior
const mocks = vi.hoisted(() => ({
    ipcMain: { handle: vi.fn() },
    pythonBridge: { runScript: vi.fn() },
    accessControlService: { verifyAccess: vi.fn(() => true) },
    validateSender: vi.fn(),
    fs: {
        rm: vi.fn(),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        copyFile: vi.fn()
    },
    // Mock fs module default export
    fsDefault: {
        rm: vi.fn(),
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        copyFile: vi.fn(),
        realpathSync: vi.fn((p) => p),
    },
    os: { tmpdir: vi.fn(() => '/mock/tmp') }
}));

// Mock modules
vi.mock('electron', () => ({
    ipcMain: mocks.ipcMain,
    app: { getPath: () => '/mock/userData', getAppPath: () => '/app' }
}));

vi.mock('../utils/python-bridge', () => ({
    PythonBridge: mocks.pythonBridge
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: mocks.validateSender
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: mocks.accessControlService
}));

vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: vi.fn()
}));

vi.mock('fs/promises', () => mocks.fs);
vi.mock('fs', () => ({ default: mocks.fsDefault }));
vi.mock('os', () => mocks.os);


describe('🛡️ Shield: Distribution PII Redaction', () => {
    let handlers: Record<string, (...args: unknown[]) => unknown> = {};

    beforeEach(() => {
        vi.clearAllMocks();
        handlers = {};
        mocks.ipcMain.handle.mockImplementation((channel, handler) => {
            handlers[channel] = handler;
        });
        setupDistributionHandlers();
    });

    const invoke = async (channel: string, ...args: unknown[]) => {
        const handler = handlers[channel];
        if (!handler) throw new Error(`No handler for ${channel}`);
        return handler({ senderFrame: { url: 'file:///app/index.html' } }, ...args);
    };

    it('should redact sensitive metadata in generate-content-id-csv', async () => {
        const sensitiveData = { title: 'Secret Song', isrc: 'US12345' };
        mocks.pythonBridge.runScript.mockResolvedValue('success');

        await invoke('distribution:generate-content-id-csv', sensitiveData);

        // Verify that sensitiveArgsIndices (6th arg) contains [0]
        expect(mocks.pythonBridge.runScript).toHaveBeenCalledWith(
            'distribution',
            'content_id_csv_generator.py',
            expect.arrayContaining([JSON.stringify(sensitiveData), '--storage-path', expect.any(String)]),
            undefined, // onProgress
            expect.anything(), // env (might be empty obj or process.env)
            [0] // Expect redaction of the first argument (data)
        );
    });

    it('should redact sensitive metadata in generate-ddex', async () => {
        const sensitiveData = { title: 'Secret Album' };
        mocks.pythonBridge.runScript.mockResolvedValue({ status: 'SUCCESS' });

        await invoke('distribution:generate-ddex', sensitiveData);

        expect(mocks.pythonBridge.runScript).toHaveBeenCalledWith(
            'distribution',
            'ddex_generator.py',
            expect.arrayContaining([JSON.stringify(sensitiveData)]),
            undefined,
            expect.anything(),
            [0] // Expect redaction of the first argument
        );
    });

     it('should redact sensitive data in generate-bwarm', async () => {
        const sensitiveData = { composer: 'John Doe' };
        mocks.pythonBridge.runScript.mockResolvedValue({ status: 'SUCCESS' });

        await invoke('distribution:generate-bwarm', sensitiveData);

        expect(mocks.pythonBridge.runScript).toHaveBeenCalledWith(
            'distribution',
            'keys_manager.py',
            expect.arrayContaining(['bwarm', JSON.stringify(sensitiveData)]),
            undefined,
            expect.anything(),
            [1] // Expect redaction of the second argument
        );
    });

    it('should redact sensitive metadata in check-merlin-status', async () => {
        const sensitiveData = { isrc: 'US123' };
        mocks.pythonBridge.runScript.mockResolvedValue({ status: 'SUCCESS' });

        await invoke('distribution:check-merlin-status', sensitiveData);

        expect(mocks.pythonBridge.runScript).toHaveBeenCalledWith(
            'distribution',
            'keys_manager.py',
            expect.arrayContaining(['merlin_check', JSON.stringify(sensitiveData)]),
            undefined,
            expect.anything(),
            [1] // Expect redaction of the second argument
        );
    });

    it('should redact sensitive metadata in register-release', async () => {
        const sensitiveData = { isrc: 'US123' };
        mocks.pythonBridge.runScript.mockResolvedValue({ status: 'SUCCESS' });

        await invoke('distribution:register-release', sensitiveData, 'release-123');

        expect(mocks.pythonBridge.runScript).toHaveBeenCalledWith(
            'distribution',
            'isrc_manager.py',
            expect.arrayContaining(['register', JSON.stringify(sensitiveData)]),
            undefined,
            expect.anything(),
            [1] // Expect redaction of the second argument
        );
    });
});
