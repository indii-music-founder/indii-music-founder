import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
