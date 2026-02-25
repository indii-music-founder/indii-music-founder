console.log('LOADING MerlinService.test.ts');
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { merlinService } from './MerlinService';
import { distributionService } from './DistributionService';
import { DistributionSyncService } from './DistributionSyncService';
import { DDEXReleaseRecord } from '@/services/metadata/types';

// Mock dependencies
vi.mock('./DistributionService', () => ({
    distributionService: {
        generateDDEX: vi.fn(),
        transmit: vi.fn()
    }
}));

vi.mock('@/services/security/CredentialService', () => ({
    credentialService: {
        getCredentials: vi.fn(),
        saveCredentials: vi.fn(),
        deleteCredentials: vi.fn()
    }
}));

// Mock window.electronAPI
(global as any).window = {
    electronAPI: {
        distribution: {
            stageRelease: vi.fn().mockResolvedValue(undefined)
        },
        credentials: {
            get: vi.fn(),
            save: vi.fn(),
            delete: vi.fn()
        }
    }
};

vi.mock('./DistributionSyncService', () => ({
    DistributionSyncService: {
        getRelease: vi.fn()
    }
}));

describe('MerlinService', () => {
    const mockReleaseId = 'release-123';
    const mockRelease: any = {
        id: mockReleaseId,
        orgId: 'org-1',
        status: 'DISTRIBUTED',
        distributors: [],
        metadata: {
            releaseTitle: 'Neon Horizon',
            artistName: 'Rex Chrome',
            releaseDate: '2026-02-20',
            labelName: 'Walking Agency',
            upc: '123456789012',
            genre: 'Synth-Pop'
        },
        assets: {
            coverArtUrl: 'https://example.com/art.jpg',
            tracks: []
        },
        createdAt: { seconds: 1234567890, nanoseconds: 0 } as any,
        updatedAt: { seconds: 1234567890, nanoseconds: 0 } as any
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        const { credentialService } = await import('@/services/security/CredentialService');
        vi.mocked(credentialService.getCredentials).mockResolvedValue({ username: 'test-user', password: 'test-password' });
    });

    it('should successfully deliver a release via SFTP', async () => {
        // Setup mocks
        vi.mocked(DistributionSyncService.getRelease).mockResolvedValue(mockRelease);
        vi.mocked(distributionService.generateDDEX).mockResolvedValue('<xml>DDEX</xml>');
        vi.mocked(distributionService.transmit).mockResolvedValue({
            status: 'SUCCESS',
            message: 'Transmitted',
            host: 'sftp.merlinnetwork.org',
            remote_path: `/incoming/${mockRelease.metadata.upc}/`
        });

        // Execute
        const result = await merlinService.deliverRelease(mockReleaseId);

        // Assert
        expect(result.success).toBe(true);
        expect(result.message).toContain('Delivered to Merlin');

        // Verify flow
        expect(DistributionSyncService.getRelease).toHaveBeenCalledWith(mockReleaseId);
        expect(distributionService.generateDDEX).toHaveBeenCalled();
        expect(distributionService.transmit).toHaveBeenCalledWith(expect.objectContaining({
            host: 'sftp.merlinnetwork.org',
            user: 'test-user',
            remotePath: expect.stringContaining(mockRelease.metadata.upc || ''),
            localPath: expect.stringContaining('release.xml')
        }));
    });

    it('should fail if release is not found', async () => {
        vi.mocked(DistributionSyncService.getRelease).mockResolvedValue(null);

        const result = await merlinService.deliverRelease('invalid-id');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Release not found');
    });

    it('should handle SFTP transmission failure', async () => {
        const { credentialService } = await import('@/services/security/CredentialService');
        vi.mocked(credentialService.getCredentials).mockResolvedValue({ username: 'test-user', password: 'test-password' });
        vi.mocked(DistributionSyncService.getRelease).mockResolvedValue(mockRelease);
        vi.mocked(distributionService.generateDDEX).mockResolvedValue('<xml>DDEX</xml>');
        vi.mocked(distributionService.transmit).mockResolvedValue({
            status: 'FAIL',
            message: 'Connection timed out',
            host: 'sftp.merlinnetwork.org',
            remote_path: `/incoming/${mockRelease.metadata.upc}/`,
            error: 'Connection timed out'
        });

        const result = await merlinService.deliverRelease(mockReleaseId);

        expect(result.success).toBe(false);
        expect(result.message).toContain('SFTP Transmission failed');
    });
});
