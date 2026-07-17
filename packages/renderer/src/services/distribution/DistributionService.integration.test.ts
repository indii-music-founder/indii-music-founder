
import { distributionService } from './DistributionService';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';


// Mock Electron API
const mockElectronAPI = {
    distribution: {
        stageRelease: vi.fn(),
        runForensics: vi.fn(),
        packageITMSP: vi.fn(),
        calculateTax: vi.fn(),
        certifyTax: vi.fn(),
        executeWaterfall: vi.fn(),
        validateMetadata: vi.fn(),
        generateISRC: vi.fn(),
        generateUPC: vi.fn(),
        generateDDEX: vi.fn(),
        generateContentIdCSV: vi.fn(),
        checkMerlinStatus: vi.fn(),
        generateBWARM: vi.fn(),
        transmit: vi.fn(),
    }
};

describe('DistributionService Integration', () => {
    beforeEach(() => {
        (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Clean up Electron API mock
        (window as unknown as { electronAPI: typeof mockElectronAPI | undefined }).electronAPI = undefined;
    });

    it('should call validateMetadata via IPC', async () => {
        const metadata = { releaseId: '123', title: 'Test Release', artists: ['Me'], tracks: [] };
        // Valid ValidationReport response
        mockElectronAPI.distribution.validateMetadata.mockResolvedValue({
            success: true,
            report: { valid: true, errors: [] }
        });

        const result = await distributionService.validateReleaseMetadata(metadata);

        expect(mockElectronAPI.distribution.validateMetadata).toHaveBeenCalledWith(metadata);
        expect(result).toEqual({ valid: true, errors: [] });
    });

    it('should call generateISRC via IPC', async () => {
        mockElectronAPI.distribution.generateISRC.mockResolvedValue({
            success: true,
            isrc: 'US-XXX-24-00001',
            report: { isrc: 'US-XXX-24-00001', status: 'SUCCESS' }
        });

        const result = await distributionService.assignISRCs();

        expect(mockElectronAPI.distribution.generateISRC).toHaveBeenCalled();
        expect(result).toBe('US-XXX-24-00001');
    });

    it('should call generateContentIdCSV via IPC', async () => {
        const data: import('@/types/distribution').ContentIdData = {
            tracks: [{ isrc: 'US123', title: 'Test' }],
            upc: '123456789012',
            artist: 'Test Artist',
            rights_attestation: {
                exclusive_rights: true,
                label: 'Test Label',
                match_policy: 'monetize',
                territories: ['US']
            }
        };
        mockElectronAPI.distribution.generateContentIdCSV.mockResolvedValue({
            success: true,
            csvData: 'ISRC,Title\nUS123,Test',
            report: { status: 'SUCCESS', generated_count: 1 }
        });

        const result = await distributionService.generateContentIdAssets(data);

        expect(mockElectronAPI.distribution.generateContentIdCSV).toHaveBeenCalledWith(data);
        expect(result).toBe('ISRC,Title\nUS123,Test');
    });

    it('should handle tax calculation errors gracefully', async () => {
        mockElectronAPI.distribution.calculateTax.mockResolvedValue({
            success: false,
            error: 'Invalid User ID'
        });

        await expect(distributionService.calculateWithholding('bad_user', 100))
            .rejects.toThrow('Invalid User ID');
    });

    it('should handle waterfall execution success', async () => {
        const data = { gross: 1000, splits: { 'user1': 1.0 } };
        // Locked Python report shape (ISSUE-826) — mirrors waterfall_payout.py output
        const mockReport = {
            gross: 1000,
            platform_fee: { percent: '15.0%', amount: 150 },
            revenue_after_fee: 850,
            recoupment: { starting_balance: 0, applied: 0, remaining_balance: 0 },
            distributions: { user1: { split: '100.0%', amount: 850 } },
            summary_status: 'PROCESSED' as const,
            total_distributed: 850,
            unallocated_balance: 0,
            processed_at: '2026-07-14T12:00:00+00:00'
        };
        mockElectronAPI.distribution.executeWaterfall.mockResolvedValue({
            success: true,
            report: mockReport
        });

        const result = await distributionService.executeWaterfall(data);
        expect(result).toEqual(mockReport);
    });

    it('should call the canonical DDEX generator via IPC', async () => {
        const metadata = { releaseId: '123', title: 'Test', artists: [], tracks: [] };
        mockElectronAPI.distribution.generateDDEX.mockResolvedValue({
            success: true,
            xml: '<xml>DDEX</xml>'
        });

        const result = await distributionService.generateIngestionNotification(metadata);
        expect(mockElectronAPI.distribution.generateDDEX).toHaveBeenCalledWith(metadata);
        expect(result).toBe('<xml>DDEX</xml>');
    });

    it('should handle SFTP transmission success', async () => {
        const config = { host: 'gateway.com', user: 'u', localPath: '/p' };
        const mockReport = { status: 'SUCCESS', message: 'OK', host: 'gateway.com', remote_path: '.' };

        mockElectronAPI.distribution.transmit = vi.fn().mockResolvedValue({
            success: true,
            report: mockReport
        });

        const result = await distributionService.transmit(config);
        expect(result).toEqual(mockReport);
        expect(mockElectronAPI.distribution.transmit).toHaveBeenCalledWith(config);
    });
});
