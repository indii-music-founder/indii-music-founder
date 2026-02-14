import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define hoisted mocks first
const {
    mockHandle,
    mockGetPath,
    mockValidateSender,
    mockValidateSafeDistributionSource,
    mockAccessControlVerifyAccess,
    mockValidateSafeHostAsync,
    mockRunScript,
    mockRm,
    mockMkdir,
    mockWriteFile,
    mockCopyFile
} = vi.hoisted(() => ({
    mockHandle: vi.fn(),
    mockGetPath: vi.fn().mockReturnValue('/app/userData'),
    mockValidateSender: vi.fn(),
    mockValidateSafeDistributionSource: vi.fn(),
    mockAccessControlVerifyAccess: vi.fn(),
    mockValidateSafeHostAsync: vi.fn(),
    mockRunScript: vi.fn(),
    mockRm: vi.fn(),
    mockMkdir: vi.fn(),
    mockWriteFile: vi.fn(),
    mockCopyFile: vi.fn()
}));

// Mock dependencies
vi.mock('electron', () => ({
    ipcMain: { handle: mockHandle },
    app: { getPath: mockGetPath }
}));

vi.mock('fs/promises', () => ({
    rm: mockRm,
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    copyFile: mockCopyFile
}));

vi.mock('../utils/ipc-security', () => ({
    validateSender: mockValidateSender
}));

vi.mock('../utils/security-checks', () => ({
    validateSafeDistributionSource: mockValidateSafeDistributionSource
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: {
        verifyAccess: mockAccessControlVerifyAccess
    }
}));

vi.mock('../utils/network-security', () => ({
    validateSafeHostAsync: mockValidateSafeHostAsync
}));

vi.mock('../utils/python-bridge', () => ({
    PythonBridge: {
        runScript: mockRunScript
    }
}));

describe('Distribution Handler Security Sandbox', () => {
    let distributionHandlers: any;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Setup default mocks
        mockAccessControlVerifyAccess.mockReturnValue(true);
        mockValidateSafeDistributionSource.mockImplementation(() => {}); // Reset to no-op
        mockValidateSafeHostAsync.mockResolvedValue('1.2.3.4'); // Safe IP
        mockRunScript.mockResolvedValue({ status: 'SUCCESS' });

        // Import the module under test
        // We use vi.importActual to get the real implementation but with mocked dependencies
        const module = await import('./distribution');
        distributionHandlers = module;

        // Register handlers
        module.setupDistributionHandlers();
    });

    describe('distribution:stage-release', () => {
        it('should block path traversal in file names', async () => {
            // Find the registered handler
            const handler = mockHandle.mock.calls.find(call => call[0] === 'distribution:stage-release')[1];
            expect(handler).toBeDefined();

            const event = { sender: {} };
            const releaseId = '123e4567-e89b-12d3-a456-426614174000'; // Valid UUID
            const files = [
                { type: 'content', data: 'test', name: '../evil.js' }
            ];

            const result = await handler(event, releaseId, files);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Validation Error');
        });

        it('should block absolute paths in file names', async () => {
            const handler = mockHandle.mock.calls.find(call => call[0] === 'distribution:stage-release')[1];
            const event = { sender: {} };
            const releaseId = '123e4567-e89b-12d3-a456-426614174000';
            const files = [
                { type: 'content', data: 'test', name: '/etc/passwd' }
            ];

            const result = await handler(event, releaseId, files);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Validation Error');
        });

        it('should verify access control for file:// paths', async () => {
            const handler = mockHandle.mock.calls.find(call => call[0] === 'distribution:stage-release')[1];
            const event = { sender: {} };
            const releaseId = '123e4567-e89b-12d3-a456-426614174000';
            const files = [
                { type: 'path', data: 'file:///sensitive/data.txt', name: 'data.txt' }
            ];

            // Mock access denial
            mockAccessControlVerifyAccess.mockReturnValue(false);

            const result = await handler(event, releaseId, files);

            expect(mockAccessControlVerifyAccess).toHaveBeenCalledWith('/sensitive/data.txt');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Security Violation: Access to /sensitive/data.txt is denied');
        });

        it('should validate source path safety for file:// paths', async () => {
            const handler = mockHandle.mock.calls.find(call => call[0] === 'distribution:stage-release')[1];
            const event = { sender: {} };
            const releaseId = '123e4567-e89b-12d3-a456-426614174000';
            const files = [
                { type: 'path', data: 'file:///safe/path/file.txt', name: 'file.txt' }
            ];

            mockAccessControlVerifyAccess.mockReturnValue(true);
            mockValidateSafeDistributionSource.mockImplementation(() => {
                throw new Error('Unsafe source path');
            });

            const result = await handler(event, releaseId, files);

            expect(mockValidateSafeDistributionSource).toHaveBeenCalledWith('/safe/path/file.txt');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsafe source path');
        });
    });

    describe('distribution:transmit', () => {
        it('should validate safe host (SSRF protection)', async () => {
            const handler = mockHandle.mock.calls.find(call => call[0] === 'distribution:transmit')[1];
            expect(handler).toBeDefined();

            const event = { sender: { send: vi.fn() } };
            const config = {
                protocol: 'SFTP',
                host: 'internal.server',
                user: 'user',
                localPath: '/local/path',
                remotePath: '/remote/path'
            };

            // Mock SSRF detection
            mockValidateSafeHostAsync.mockRejectedValue(new Error('SSRF Detected: Host resolves to private IP'));

            const result = await handler(event, config);

            expect(mockValidateSafeHostAsync).toHaveBeenCalledWith('internal.server');
            expect(result.success).toBe(false);
            expect(result.error).toContain('SSRF Detected');
        });

        it('should verify access control for local path', async () => {
            const handler = mockHandle.mock.calls.find(call => call[0] === 'distribution:transmit')[1];
            const event = { sender: { send: vi.fn() } };
            const config = {
                protocol: 'SFTP',
                host: 'example.com',
                user: 'user',
                localPath: '/restricted/file',
                remotePath: '/remote'
            };

            mockAccessControlVerifyAccess.mockReturnValue(false);

            const result = await handler(event, config);

            expect(mockAccessControlVerifyAccess).toHaveBeenCalledWith('/restricted/file');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Security Violation');
        });

        it('should pass sensitive data via environment variables', async () => {
            const handler = mockHandle.mock.calls.find(call => call[0] === 'distribution:transmit')[1];
            const event = { sender: { send: vi.fn() } };
            const config = {
                protocol: 'SFTP',
                host: 'example.com',
                user: 'user',
                password: 'secret-password',
                localPath: '/safe/path',
                remotePath: '/remote'
            };

            mockAccessControlVerifyAccess.mockReturnValue(true);

            const result = await handler(event, config);

            expect(mockRunScript).toHaveBeenCalledWith(
                'distribution',
                'sftp_uploader.py',
                expect.arrayContaining(['--host', 'example.com']), // Args should NOT contain password
                expect.any(Function),
                expect.objectContaining({ // Env MUST contain password
                    SFTP_PASSWORD: 'secret-password'
                })
            );

            // Ensure password is NOT in args
            const callArgs = mockRunScript.mock.calls[0][2];
            expect(callArgs).not.toContain('secret-password');
        });

        it('should validate key file path if provided', async () => {
            const handler = mockHandle.mock.calls.find(call => call[0] === 'distribution:transmit')[1];
            const event = { sender: { send: vi.fn() } };
            const config = {
                protocol: 'SFTP',
                host: 'example.com',
                user: 'user',
                key: '/path/to/private.key',
                localPath: '/safe/path'
            };

            mockAccessControlVerifyAccess.mockImplementation((path) => {
                if (path === '/path/to/private.key') return false; // Deny access to key
                return true;
            });

            const result = await handler(event, config);

            expect(mockAccessControlVerifyAccess).toHaveBeenCalledWith('/path/to/private.key');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Security Violation: Access to key file');
        });
    });
});
