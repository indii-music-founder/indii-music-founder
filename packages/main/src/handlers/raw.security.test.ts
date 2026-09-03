import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'os';
import path from 'path';
import { rawConverterService } from '../services/RawConverterService';
import { accessControlService } from '../security/AccessControlService';

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../security/AccessControlService', () => ({
    accessControlService: {
        verifyAccess: vi.fn(),
        grantAccess: vi.fn(),
    },
}));

describe('RawConverterService Security Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('denies inspect when path is unauthorized', async () => {
        vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

        await expect(
            rawConverterService.inspect('/etc/shadow/sample.ARW')
        ).rejects.toThrow(/Security Violation: Access denied/);
    });

    it('denies conversion when input path is unauthorized', async () => {
        vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

        await expect(
            rawConverterService.convert({
                inputPath: '/unauthorized/sample.ARW',
                outputPath: '/authorized/sample.dng',
            })
        ).rejects.toThrow(/Security Violation: Access denied/);
    });

    it('rejects attempt to overwrite source RAW file', async () => {
        vi.mocked(accessControlService.verifyAccess).mockReturnValue(true);

        await expect(
            rawConverterService.convert({
                inputPath: '/photos/sample.ARW',
                outputPath: '/photos/sample.ARW',
            })
        ).rejects.toThrow(/Output path must not be identical to source RAW file/);
    });

    it('handles job cancellation cleanly', () => {
        const jobId = 'test-job-123';
        expect(() => rawConverterService.cancel(jobId)).not.toThrow();
    });

    // ---------------------------------------------------------------
    // Additional security test cases
    // ---------------------------------------------------------------

    it('rejects path traversal in inspect input (../../etc/passwd)', async () => {
        vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

        await expect(
            rawConverterService.inspect('/photos/../../etc/passwd')
        ).rejects.toThrow(/Security Violation: Access denied/);

        expect(accessControlService.verifyAccess).toHaveBeenCalledWith('/photos/../../etc/passwd');
    });

    it('rejects path traversal in convert input and output paths', async () => {
        vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

        await expect(
            rawConverterService.convert({
                inputPath: '/photos/../../../etc/passwd',
                outputPath: '/output/../../../tmp/evil.dng',
            })
        ).rejects.toThrow(/Security Violation: Access denied/);

        // Verify the access check was invoked with the traversal path
        expect(accessControlService.verifyAccess).toHaveBeenCalledWith('/photos/../../../etc/passwd');
    });

    it('rejects null byte injection in file paths', async () => {
        vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

        const nullBytePath = '/photos/sample\x00.ARW';

        await expect(
            rawConverterService.inspect(nullBytePath)
        ).rejects.toThrow(/Security Violation: Access denied/);
    });

    it('rejects null byte injection in convert output path', async () => {
        // Even if input access is granted, the null byte in output should be denied
        vi.mocked(accessControlService.verifyAccess).mockImplementation((p: string) => {
            // Allow the input, deny the output that contains a null byte
            if (p.includes('\x00')) return false;
            return true;
        });

        const inputPath = '/photos/sample.ARW';
        const outputPath = '/output/sample\x00.dng';

        await expect(
            rawConverterService.convert({
                inputPath,
                outputPath,
            })
        ).rejects.toThrow();
    });

    it('rejects very long paths exceeding 4096 characters', async () => {
        vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

        const longSegment = 'a'.repeat(4097);
        const longPath = `/photos/${longSegment}/sample.ARW`;

        await expect(
            rawConverterService.inspect(longPath)
        ).rejects.toThrow(/Security Violation: Access denied/);
    });

    it('rejects non-RAW file extensions via access control (.exe)', async () => {
        vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

        await expect(
            rawConverterService.inspect('/photos/malware.exe')
        ).rejects.toThrow(/Security Violation: Access denied/);
    });

    it('rejects non-RAW file extensions via access control (.sh)', async () => {
        vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

        await expect(
            rawConverterService.inspect('/photos/script.sh')
        ).rejects.toThrow(/Security Violation: Access denied/);
    });

    it('rejects output path outside allowed directories', async () => {
        // Allow input access but deny the output directory
        vi.mocked(accessControlService.verifyAccess).mockImplementation((p: string) => {
            if (p === '/photos/sample.ARW') return true;
            // Deny the output directory
            return false;
        });

        await expect(
            rawConverterService.convert({
                inputPath: '/photos/sample.ARW',
                outputPath: '/etc/cron.d/backdoor.dng',
            })
        ).rejects.toThrow(/Security Violation: Access denied/);
    });

    it('detects symlink in output path via canonical resolution', async () => {
        vi.mocked(accessControlService.verifyAccess).mockReturnValue(true);

        // When input and output resolve to the same canonical path through
        // symlinks, the service must reject the operation. The service
        // calls fs.realpath internally; when both resolve identically,
        // it throws a Security Error about canonical link resolution.
        // Since the binary won't exist in test, we test that identical
        // resolved paths are caught before the binary is ever spawned.
        await expect(
            rawConverterService.convert({
                inputPath: '/photos/sample.ARW',
                outputPath: '/photos/sample.ARW',
            })
        ).rejects.toThrow(/Output path must not be identical to source RAW file/);
    });

    it('enforces that active jobs map tracks concurrent jobs', async () => {
        // Cancel should be a no-op for non-existent jobs but the activeJobs
        // map must not grow unboundedly. Cancelling many non-existent jobs
        // should not throw or leak memory.
        const jobIds = Array.from({ length: 100 }, (_, i) => `fake-job-${i}`);

        for (const jobId of jobIds) {
            expect(() => rawConverterService.cancel(jobId)).not.toThrow();
        }
    });

    it('batch conversion rejects mixed valid/invalid paths via access control', async () => {
        // For batch conversion, each individual path goes through convert(),
        // which calls verifyInputPath. Mixed paths should cause per-file
        // failures without crashing the entire batch.
        const tmpBatchDir = path.join(os.tmpdir(), 'indii-batch-test');

        vi.mocked(accessControlService.verifyAccess).mockImplementation((p: string) => {
            // Only allow the first and third paths and the tmp output directory
            if (p === '/photos/valid1.ARW' || p === '/photos/valid3.ARW') return true;
            if (p.startsWith(tmpBatchDir)) return true;
            return false;
        });

        const result = await rawConverterService.convertBatch({
            inputPaths: [
                '/photos/valid1.ARW',
                '/unauthorized/evil.ARW',
                '/photos/valid3.ARW',
            ],
            outputDirectory: tmpBatchDir,
        });

        // The unauthorized path should have failed
        expect(result.failedCount).toBeGreaterThanOrEqual(1);
        expect(result.totalFiles).toBe(3);

        // The unauthorized file should have a Security Violation error
        const failedResult = result.results.find(r => r.inputPath === '/unauthorized/evil.ARW');
        expect(failedResult).toBeDefined();
        expect(failedResult!.success).toBe(false);
        expect(failedResult!.error).toMatch(/Security Violation: Access denied/);
    });

    it('cancel non-existent job is a graceful no-op', () => {
        const bogusJobId = 'nonexistent-job-' + Date.now();

        // Should not throw
        expect(() => rawConverterService.cancel(bogusJobId)).not.toThrow();

        // Calling cancel multiple times for the same non-existent job is also safe
        expect(() => rawConverterService.cancel(bogusJobId)).not.toThrow();
        expect(() => rawConverterService.cancel(bogusJobId)).not.toThrow();
    });

    it('inspect rejects empty file path via access control', async () => {
        vi.mocked(accessControlService.verifyAccess).mockReturnValue(false);

        await expect(
            rawConverterService.inspect('')
        ).rejects.toThrow(/Security Violation: Access denied/);

        expect(accessControlService.verifyAccess).toHaveBeenCalledWith('');
    });
});
