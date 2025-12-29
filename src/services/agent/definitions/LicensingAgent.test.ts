import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LicensingAgent } from './LicensingAgent';
import { licensingService } from '../../licensing/LicensingService';
import { licenseScannerService } from '../../knowledge/LicenseScannerService';

vi.mock('../../licensing/LicensingService', () => ({
    licensingService: {
        createRequest: vi.fn(),
        updateRequest: vi.fn(),
        updateRequestStatus: vi.fn()
    }
}));

vi.mock('../../knowledge/LicenseScannerService', () => ({
    licenseScannerService: {
        scanUrl: vi.fn()
    }
}));

// Mock the prompt import which uses Vite's ?raw
vi.mock('@agents/licensing/prompt.md?raw', () => ({
    default: 'Mock System Prompt'
}));

describe('LicensingAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('check_availability', () => {
        it('should handle availability check with URL scanning', async () => {
            const mockScanResult = {
                licenseType: 'Royalty-Free',
                termsSummary: 'Free for use',
                isCommercialAllowed: true
            };
            vi.mocked(licenseScannerService.scanUrl).mockResolvedValue(mockScanResult as any);
            vi.mocked(licensingService.createRequest).mockResolvedValue('new-request-id');

            const args = {
                title: 'Test Track',
                artist: 'Test Artist',
                usage: 'Commercial Video',
                url: 'https://example.com/license'
            };

            const result = await (LicensingAgent.functions!.check_availability as any)(args);

            expect(licenseScannerService.scanUrl).toHaveBeenCalledWith(args.url);
            expect(licensingService.createRequest).toHaveBeenCalledWith(expect.objectContaining({
                title: args.title,
                status: 'checking'
            }));

            expect(result.success).toBe(true);
            expect(result.data.status).toBe('available');
            expect(result.data.requestId).toBe('new-request-id');
        });

        it('should handle restricted licenses identified by AI', async () => {
            const mockScanResult = {
                licenseType: 'Rights-Managed',
                termsSummary: 'Negotiation required',
                isCommercialAllowed: false
            };
            vi.mocked(licenseScannerService.scanUrl).mockResolvedValue(mockScanResult as any);
            vi.mocked(licensingService.createRequest).mockResolvedValue('restricted-request-id');

            const args = {
                title: 'Famous Song',
                artist: 'Famous Artist',
                usage: 'Film Sync',
                url: 'https://label.com/rights'
            };

            const result = await (LicensingAgent.functions!.check_availability as any)(args);

            expect(result.data.status).toBe('restricted');
            expect(result.data.requestId).toBe('restricted-request-id');
        });

        it('should default to pending if no URL is provided', async () => {
            vi.mocked(licensingService.createRequest).mockResolvedValue('pending-request-id');

            const args = {
                title: 'Unknown Track',
                artist: 'Unknown Artist',
                usage: 'Background music'
            };

            const result = await (LicensingAgent.functions!.check_availability as any)(args);

            expect(licenseScannerService.scanUrl).not.toHaveBeenCalled();
            expect(result.data.status).toBe('pending');
            expect(result.data.requestId).toBe('pending-request-id');
        });
    });

    describe('analyze_contract', () => {
        it('should return a placeholder analysis', async () => {
            const args = {
                file_data: 'base64data',
                mime_type: 'application/pdf'
            };

            const result = await (LicensingAgent.functions!.analyze_contract as any)(args);

            expect(result.success).toBe(true);
            expect(result.data.summary).toContain('analysis'); // Changed from 'analyzed' to 'analysis'
        });
    });
});
